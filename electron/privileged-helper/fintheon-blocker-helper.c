#include <ctype.h>
#include <errno.h>
#include <fcntl.h>
#include <grp.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/un.h>
#include <unistd.h>

#define SOCKET_PATH "/var/run/fintheon-blocker.sock"
#define HOSTS_PATH "/etc/hosts"
#define RESOLVER_DIR "/etc/resolver"
#define MARKER_START "# FINTHEON-BLOCKER-START"
#define MARKER_END "# FINTHEON-BLOCKER-END"
#define MAX_DOMAINS 80
#define MAX_DOMAIN_LEN 253
#define BUFFER_SIZE 65536

static char *read_text(const char *path) {
  FILE *file = fopen(path, "r");
  if (!file) return strdup("");
  fseek(file, 0, SEEK_END);
  long size = ftell(file);
  fseek(file, 0, SEEK_SET);
  if (size < 0 || size > 1024 * 1024) {
    fclose(file);
    return strdup("");
  }
  char *data = calloc((size_t)size + 1, 1);
  if (!data) {
    fclose(file);
    return strdup("");
  }
  fread(data, 1, (size_t)size, file);
  fclose(file);
  return data;
}

static int write_text(const char *path, const char *text) {
  int fd = open(path, O_WRONLY | O_CREAT | O_TRUNC, 0644);
  if (fd < 0) return -1;
  size_t len = strlen(text);
  ssize_t written = write(fd, text, len);
  close(fd);
  return written == (ssize_t)len ? 0 : -1;
}

static int has_marker(void) {
  char *hosts = read_text(HOSTS_PATH);
  int found = strstr(hosts, MARKER_START) && strstr(hosts, MARKER_END);
  free(hosts);
  return found ? 1 : 0;
}

static char *strip_block(const char *hosts) {
  const char *start = strstr(hosts, MARKER_START);
  const char *end = strstr(hosts, MARKER_END);
  if (!start || !end || end < start) return strdup(hosts);
  end += strlen(MARKER_END);
  while (*end == '\r' || *end == '\n') end++;
  size_t before = (size_t)(start - hosts);
  while (before > 0 && (hosts[before - 1] == '\n' || hosts[before - 1] == '\r'))
    before--;
  size_t after = strlen(end);
  char *next = calloc(before + after + 3, 1);
  if (!next) return strdup(hosts);
  memcpy(next, hosts, before);
  if (before > 0 && after > 0) strcat(next, "\n");
  strcat(next, end);
  return next;
}

static int valid_domain(const char *domain) {
  size_t len = strlen(domain);
  if (len < 3 || len > MAX_DOMAIN_LEN) return 0;
  if (domain[0] == '.' || domain[len - 1] == '.') return 0;
  if (!strchr(domain, '.')) return 0;
  for (size_t i = 0; i < len; i++) {
    unsigned char c = (unsigned char)domain[i];
    if (!(isalnum(c) || c == '.' || c == '-')) return 0;
  }
  return 1;
}

static void etld_plus_one(const char *domain, char *out, size_t out_len) {
  const char *last = strrchr(domain, '.');
  if (!last) {
    snprintf(out, out_len, "%s", domain);
    return;
  }
  const char *cursor = last - 1;
  while (cursor > domain && *cursor != '.') cursor--;
  const char *start = *cursor == '.' ? cursor + 1 : domain;
  snprintf(out, out_len, "%s", start);
}

static void flush_dns(void) {
  system("/usr/bin/dscacheutil -flushcache >/dev/null 2>&1");
  system("/usr/bin/killall -HUP mDNSResponder >/dev/null 2>&1");
}

static void remove_resolver(const char *domain) {
  char etld[MAX_DOMAIN_LEN + 1];
  char path[512];
  etld_plus_one(domain, etld, sizeof(etld));
  snprintf(path, sizeof(path), "%s/%s", RESOLVER_DIR, etld);
  unlink(path);
}

static void remove_marked_resolvers(const char *hosts) {
  const char *start = strstr(hosts, MARKER_START);
  const char *end = strstr(hosts, MARKER_END);
  if (!start || !end || end <= start) return;
  const char *cursor = start;
  while (cursor < end) {
    const char *line_end = strchr(cursor, '\n');
    if (!line_end || line_end > end) line_end = end;
    char line[320] = {0};
    size_t len = (size_t)(line_end - cursor);
    if (len >= sizeof(line)) len = sizeof(line) - 1;
    memcpy(line, cursor, len);
    char domain[MAX_DOMAIN_LEN + 1] = {0};
    if (sscanf(line, "0.0.0.0 %253s", domain) == 1 && valid_domain(domain))
      remove_resolver(domain);
    cursor = line_end + 1;
  }
}

static int write_resolver(const char *domain) {
  char etld[MAX_DOMAIN_LEN + 1];
  char path[512];
  mkdir(RESOLVER_DIR, 0755);
  etld_plus_one(domain, etld, sizeof(etld));
  snprintf(path, sizeof(path), "%s/%s", RESOLVER_DIR, etld);
  return write_text(path, "nameserver 127.0.0.1\n");
}

static int parse_domains(char *line, char domains[MAX_DOMAINS][MAX_DOMAIN_LEN + 1]) {
  int count = 0;
  char *token = strtok(line, " \t\r\n");
  while ((token = strtok(NULL, " \t\r\n")) != NULL) {
    if (count >= MAX_DOMAINS || !valid_domain(token)) return -1;
    snprintf(domains[count], MAX_DOMAIN_LEN + 1, "%s", token);
    count++;
  }
  return count;
}

static int enable_domains(char domains[MAX_DOMAINS][MAX_DOMAIN_LEN + 1], int count) {
  char *hosts = read_text(HOSTS_PATH);
  char *base = strip_block(hosts);
  free(hosts);
  size_t needed = strlen(base) + 128;
  for (int i = 0; i < count; i++) needed += strlen(domains[i]) + 16;
  char *next = calloc(needed, 1);
  if (!next) {
    free(base);
    return -1;
  }
  strcat(next, base);
  if (strlen(next) > 0) strcat(next, "\n\n");
  strcat(next, MARKER_START "\n");
  for (int i = 0; i < count; i++) {
    strcat(next, "0.0.0.0 ");
    strcat(next, domains[i]);
    strcat(next, "\n");
    write_resolver(domains[i]);
  }
  strcat(next, MARKER_END "\n");
  int ok = write_text(HOSTS_PATH, next);
  free(base);
  free(next);
  flush_dns();
  return ok;
}

static int disable_domains(char domains[MAX_DOMAINS][MAX_DOMAIN_LEN + 1], int count) {
  char *hosts = read_text(HOSTS_PATH);
  remove_marked_resolvers(hosts);
  char *next = strip_block(hosts);
  int ok = write_text(HOSTS_PATH, next);
  for (int i = 0; i < count; i++) remove_resolver(domains[i]);
  free(hosts);
  free(next);
  flush_dns();
  return ok;
}

static void reply(int client, const char *json) {
  dprintf(client, "%s\n", json);
}

static void handle_client(int client) {
  char buffer[BUFFER_SIZE];
  ssize_t size = read(client, buffer, sizeof(buffer) - 1);
  if (size <= 0) return;
  buffer[size] = '\0';

  char command[32] = {0};
  sscanf(buffer, "%31s", command);
  for (char *p = command; *p; p++) *p = (char)toupper((unsigned char)*p);

  if (strcmp(command, "STATUS") == 0) {
    dprintf(client, "{\"ok\":true,\"running\":true,\"blocked\":%s}\n",
            has_marker() ? "true" : "false");
    return;
  }

  char domains[MAX_DOMAINS][MAX_DOMAIN_LEN + 1];
  int count = parse_domains(buffer, domains);
  if (count < 0 || (strcmp(command, "ENABLE") == 0 && count == 0)) {
    reply(client, "{\"ok\":false,\"reason\":\"invalid domains\"}");
    return;
  }

  if (strcmp(command, "ENABLE") == 0) {
    if (enable_domains(domains, count) == 0)
      dprintf(client, "{\"ok\":true,\"mode\":\"helper\",\"domainCount\":%d}\n",
              count);
    else
      reply(client, "{\"ok\":false,\"reason\":\"enable failed\"}");
    return;
  }

  if (strcmp(command, "DISABLE") == 0 || strcmp(command, "RESET") == 0) {
    if (disable_domains(domains, count) == 0)
      reply(client, "{\"ok\":true,\"mode\":\"helper\"}");
    else
      reply(client, "{\"ok\":false,\"reason\":\"disable failed\"}");
    return;
  }

  reply(client, "{\"ok\":false,\"reason\":\"unknown command\"}");
}

int main(void) {
  int server = socket(AF_UNIX, SOCK_STREAM, 0);
  if (server < 0) return 1;

  unlink(SOCKET_PATH);
  struct sockaddr_un addr;
  memset(&addr, 0, sizeof(addr));
  addr.sun_family = AF_UNIX;
  strncpy(addr.sun_path, SOCKET_PATH, sizeof(addr.sun_path) - 1);

  if (bind(server, (struct sockaddr *)&addr, sizeof(addr)) < 0) return 1;
  struct group *admin = getgrnam("admin");
  chown(SOCKET_PATH, 0, admin ? admin->gr_gid : 0);
  chmod(SOCKET_PATH, admin ? 0660 : 0600);
  if (listen(server, 16) < 0) return 1;

  for (;;) {
    int client = accept(server, NULL, NULL);
    if (client < 0) continue;
    handle_client(client);
    close(client);
  }
}
