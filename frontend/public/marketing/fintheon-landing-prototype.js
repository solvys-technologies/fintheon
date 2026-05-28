const nav = document.querySelector("[data-nav]");
const form = document.querySelector(".tunnel-card");
const emailInput = form?.querySelector("input");

function handleScroll() {
  if (!nav) return;
  nav.classList.toggle("is-scrolled", window.scrollY > 80);
}

function handleSubmit(event) {
  event.preventDefault();
  if (!form || !emailInput) return;

  const address = emailInput.value.trim();
  const button = form.querySelector("button");
  if (!button) return;

  if (!address || !address.includes("@")) {
    button.textContent = "Enter email";
    window.setTimeout(() => {
      button.textContent = "Request access";
    }, 1400);
    return;
  }

  button.textContent = "Request received";
  emailInput.value = "";
}

window.addEventListener("scroll", handleScroll, { passive: true });
form?.addEventListener("submit", handleSubmit);
handleScroll();
