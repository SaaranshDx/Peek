console.log("Content script loaded!");

chrome.runtime.onMessage.addListener((message) => {
    console.log(message);

    if (message.type !== "peek") return;

    // Remove any existing peek window
    document.getElementById("peek-overlay")?.remove();

    // Create overlay
    const overlay = document.createElement("div");
    overlay.id = "peek-overlay";

    overlay.innerHTML = `
        <div id="peek-window">
            <div id="peek-header">
                <span>Peek</span>
                <div id="peek-actions">
                    <button id="peek-fullscreen" title="Fullscreen">⛶</button>
                    <button id="peek-newtab" title="Open in new tab">↗</button>
                    <button id="peek-close" title="Close">✕</button>
                </div>
            </div>

            <div id="peek-loader"></div>
            <iframe src="${message.url}"></iframe>
            <div id="peek-resize-handle"></div>
        </div>
    `;

    const iframe = overlay.querySelector("iframe");
    const loader = overlay.querySelector("#peek-loader");

    iframe.style.display = "none";
    iframe.onload = () => {
        loader.style.display = "none";
        iframe.style.display = "";
    };

    document.body.appendChild(overlay);

    const peekWindow = overlay.querySelector("#peek-window");

    // Close button
    overlay.querySelector("#peek-close").onclick = () => {
        overlay.remove();
    };

    // Fullscreen toggle (fills the viewport within the overlay)
    overlay.querySelector("#peek-fullscreen").onclick = () => {
        peekWindow.classList.toggle("peek-fullscreen");
    };

    // Open in new tab
    overlay.querySelector("#peek-newtab").onclick = () => {
        window.open(message.url, "_blank");
        overlay.remove();
    };

    // Click outside window closes it
    overlay.onclick = (e) => {
        if (e.target === overlay)
            overlay.remove();
    };

    // Resize via drag on the handle
    const handle = overlay.querySelector("#peek-resize-handle");
    let onMouseMove, onMouseUp;

    const cancelResize = () => {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        if (onMouseMove) document.removeEventListener("mousemove", onMouseMove);
        if (onMouseUp) document.removeEventListener("mouseup", onMouseUp);
        onMouseMove = onMouseUp = undefined;
    };

    handle.onmousedown = (e) => {
        e.preventDefault();

        const startX = e.clientX;
        const startY = e.clientY;
        const startW = peekWindow.offsetWidth;
        const startH = peekWindow.offsetHeight;

        document.body.style.cursor = "nwse-resize";
        document.body.style.userSelect = "none";

        onMouseMove = (ev) => {
            const w = Math.max(300, startW + (ev.clientX - startX));
            const h = Math.max(200, startH + (ev.clientY - startY));
            peekWindow.style.width = w + "px";
            peekWindow.style.height = h + "px";
        };

        onMouseUp = () => {
            cancelResize();
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    };

    // Cleanup resize whenever the overlay is removed
    const origRemove = overlay.remove.bind(overlay);
    overlay.remove = () => {
        cancelResize();
        origRemove();
    };
});