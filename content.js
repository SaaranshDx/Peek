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
});