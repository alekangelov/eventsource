import EventSource from "./index";

const DEMO_URL = "https://sse-demo.netlify.app/sse";

const ev = new EventSource(DEMO_URL);

const postToUl = (text: string) => {
  const ul = document.querySelector("ul");
  const li = document.createElement("li");
  li.innerText = text;

  return ul?.appendChild(li);
};

ev.subscribe("message", (event) => {
  postToUl(event.data);
});

ev.subscribe("open", () => {
  postToUl("Connection opened at " + new Date().toLocaleTimeString());
});

ev.subscribe("error", () => {
  postToUl("Error at " + new Date().toLocaleTimeString());
});

ev.subscribe("close", () => {
  postToUl("Connection closed at " + new Date().toLocaleTimeString());
});

const open = document.querySelector("#open");

open?.addEventListener("click", () => {
  ev.open();
});

const close = document.querySelector("#close");

close?.addEventListener("click", () => {
  ev.close();
});
