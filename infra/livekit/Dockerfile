FROM livekit/livekit-server:latest

COPY livekit.yaml /etc/livekit.yaml
COPY start-livekit.sh /usr/local/bin/start-livekit

RUN chmod +x /usr/local/bin/start-livekit

ENTRYPOINT ["/usr/local/bin/start-livekit"]
