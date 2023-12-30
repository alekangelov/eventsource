interface Options {}

const DEFAULT_OPTIONS: Options = {};

class MessageEvent {
  constructor(
    public data: string = "",
    public lastEventId: string = "",
    public origin: string = "",
    public target: EventSource,
    public ports: never[] = []
  ) {}
}

class CloseEvent {
  constructor(
    public wasClean: boolean = false,
    public code: number = 0,
    public reason: string = "",
    public target: EventSource
  ) {}
}

class ErrorEvent {
  constructor(
    public message: string = "",
    public filename: string = "",
    public lineno: number = 0,
    public colno: number = 0,
    public error: Error = new Error(),
    public target: EventSource
  ) {}
}

class OpenEvent {
  constructor(public target: EventSource) {}
}

type EventListenerMap = {
  message: (event: MessageEvent) => void;
  open: (event: OpenEvent) => void;
  error: (event: ErrorEvent) => void;
  close: (event: CloseEvent) => void;
};

// if it's \n, \r, \t, \f, or \v, remove the backslash
const UNESCAPE_REGEX = /\\(\n|\r|\t|\f|\v)/g;

const unescape = (str: string) => {
  return str.replace(UNESCAPE_REGEX, "$1");
};

export default class EventSource {
  // @ts-expect-error
  #options: Options;

  #url: string;

  #xhr?: XMLHttpRequest;

  #listeners: {
    [key in keyof EventListenerMap]: EventListenerMap[key][];
  } = {
    message: [],
    open: [],
    error: [],
    close: [],
  };

  constructor(url: string, options: Options = {}) {
    this.#options = { ...DEFAULT_OPTIONS, ...options };

    this.#url = url;

    this.open();
  }

  #dispatch<T extends keyof EventListenerMap>(
    type: T,
    event: Parameters<EventListenerMap[T]>[0]
  ) {
    this.#listeners[type].forEach((listener) => {
      listener(event as any);
    });
  }

  #parseMessage(data?: string) {
    if (!data) return;

    const isData = data.startsWith("data: ");
    const isEvent = data.startsWith("event: ");
    const isId = data.startsWith("id: ");
    const isRetry = data.startsWith("retry: ");
    const isComment = data.startsWith(":");
    const isPing = data.startsWith("ping");

    if (isComment) return;

    if (isPing) {
      this.#xhr?.abort();
      this.open();
      return;
    }

    if (isRetry) {
      const retry = data.replace("retry: ", "");

      setTimeout(() => {
        this.#xhr?.abort();
        this.open();
      }, Number(retry));

      return;
    }

    if (isId) return;

    if (isEvent) return;

    if (!isData) return;

    const realMessage = data.replace("data: ", "");

    const event = new MessageEvent(realMessage, "", "", this);

    this.#dispatch("message", event);
  }

  open() {
    if (this.#xhr?.readyState === 3) return;
    if (!this.#xhr) this.#xhr = new XMLHttpRequest();

    this.#dispatch("open", new OpenEvent(this));

    this.#xhr.open("GET", this.#url);
    this.#xhr.setRequestHeader("Accept", "text/event-stream");
    this.#xhr.send();

    this.#xhr.onreadystatechange = () => {
      if (this.#xhr?.readyState === 3) {
        const data = this.#xhr.responseText;

        const messages = data
          .split("\n")
          .map((m) => unescape(m).trim())
          .filter(Boolean);

        console.log(messages[messages.length - 1]);

        this.#parseMessage(messages[messages.length - 1]);
      }
    };

    this.#xhr.onerror = () => {
      this.#dispatch("error", new ErrorEvent("", "", 0, 0, new Error(), this));
    };

    this.#xhr.onabort = () => {
      this.#dispatch("close", new CloseEvent(false, 0, "", this));
    };

    // this.#xhr.onprogress = () => {
    //   const data = this.#xhr?.responseText;

    //   const messages =
    //     data
    //       ?.split("\n")
    //       .map((m) => unescape(m).trim())
    //       .filter(Boolean) ?? [];

    //   this.#parseMessage(messages[messages.length - 1]);
    // };
  }

  subscribe<T extends keyof EventListenerMap>(
    type: T,
    listener: EventListenerMap[T]
  ) {
    this.#listeners[type].push(listener);

    const index = this.#listeners[type].indexOf(listener);
    return () => {
      this.#listeners[type].splice(index, 1);
    };
  }

  unsubscribe<T extends keyof EventListenerMap>(
    type: T,
    listener: EventListenerMap[T]
  ) {
    const index = this.#listeners[type].indexOf(listener);
    this.#listeners[type].splice(index, 1);
  }

  close() {
    this.#xhr?.abort();
  }
}
