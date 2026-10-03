/*
 * Bare Metal behaviour. Menus are native popovers (no script). The one custom element is the book
 * shelf: buttons scroll the same native scroll-snap container, so there is no carousel library.
 *   <if-shelf> … <div data-shelf-track>, <button data-shelf-prev|next> … </if-shelf>
 * Without script the shelf is still a scrollable, snap-aligned row.
 */
class IfShelf extends HTMLElement {
  connectedCallback() {
    const track = this.querySelector("[data-shelf-track]");
    const nudge = (direction) => {
      const step = Math.max(280, Math.round(track.clientWidth * 0.8));
      track.scrollBy({ left: direction * step, behavior: "smooth" });
    };
    this.querySelector("[data-shelf-prev]")?.addEventListener("click", () => nudge(-1));
    this.querySelector("[data-shelf-next]")?.addEventListener("click", () => nudge(1));
  }
}
customElements.define("if-shelf", IfShelf);
