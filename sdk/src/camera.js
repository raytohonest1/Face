export class Camera {
  #video;
  #stream = null;

  constructor(video) {
    this.#video = video;
  }

  async start() {
    if (!window.isSecureContext) {
      throw new Error("카메라는 HTTPS 또는 localhost에서만 사용 가능합니다.");
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("이 브라우저는 카메라 접근을 지원하지 않습니다.");
    }

    this.#stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });

    this.#video.srcObject = this.#stream;
    await this.#waitForMetadata();
    await this.#video.play();
  }

  stop() {
    this.#video.pause();
    this.#video.srcObject = null;
    if (this.#stream) {
      this.#stream.getTracks().forEach((t) => t.stop());
      this.#stream = null;
    }
  }

  get video() { return this.#video; }

  #waitForMetadata() {
    if (this.#video.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve();
    return new Promise((resolve) => {
      this.#video.addEventListener("loadedmetadata", resolve, { once: true });
    });
  }
}
