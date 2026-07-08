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
                <button id="peek-close">✕</button>
            </div>

            <iframe src="${message.url}"></iframe>
        </div>
    `;

    document.body.appendChild(overlay);

    // Close button
    overlay.querySelector("#peek-close").onclick = () => {
        overlay.remove();
    };

    // Click outside window closes it
    overlay.onclick = (e) => {
        if (e.target === overlay)
            overlay.remove();
    };
});