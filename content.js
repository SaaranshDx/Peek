console.log("Content script loaded!");

chrome.runtime.onMessage.addListener((message) => {
    console.log(message);

    if (message.type !== "peek") return;

    // Remove any existing peek window
    document.getElementById("peek-overlay")?.remove();

    // Create overlay
    const overlay = document.createElement("div");
    overlay.id = "peek-overlay";

    const urlObj = new URL(message.url);

    overlay.innerHTML = `
        <div id="peek-window">
            <div id="peek-header">
                <span id="peek-title">${urlObj.hostname}</span>
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

    let loadError = false;

    iframe.onerror = () => {
        loadError = true;
        loader.style.display = "none";
        iframe.style.display = "none";
        showError();
    };

    const titleSpan = overlay.querySelector("#peek-title");

    iframe.onload = () => {
        loader.style.display = "none";
        let sameOrigin = false;
        let blocked = false;

        try {
            const doc = iframe.contentDocument;
            if (doc && doc.body && doc.body.children.length > 1) {
                sameOrigin = true;
            } else {
                blocked = true;
            }
        } catch {
            // Cross-origin: contentDocument access throws
        }

        if (blocked) {
            loadError = true;
            iframe.style.display = "none";
            showError();
            return;
        }

        iframe.style.display = "";

        if (sameOrigin) {
            try {
                const t = iframe.contentDocument.title;
                if (t) titleSpan.textContent = t;
            } catch {}
        } else {
            // Cross-origin: fetch page to extract title
            fetch(message.url)
                .then(r => r.text())
                .then(html => {
                    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                    titleSpan.textContent = match ? match[1] : urlObj.hostname;
                })
                .catch(() => {
                    titleSpan.textContent = urlObj.hostname;
                });
        }
    };

    const showError = () => {
        const err = document.createElement("div");
        err.id = "peek-error";
        err.innerHTML = `
            <span>This site can't be loaded in the preview.</span>
            <a href="${message.url}" target="_blank" id="peek-error-link">Open in new tab →</a>
        `;
        peekWindow.appendChild(err);
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

    // Dragging via the header
    const header = overlay.querySelector("#peek-header");
    let dragStartX, dragStartY, dragOriginX, dragOriginY;

    const cancelDrag = () => {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        header.removeEventListener("pointermove", onDragMove);
        header.removeEventListener("pointerup", onDragEnd);
    };

    const onDragMove = (ev) => {
        const dx = ev.clientX - dragStartX;
        const dy = ev.clientY - dragStartY;
        peekWindow.style.transform = `translate(${dragOriginX + dx}px, ${dragOriginY + dy}px)`;
    };

    const onDragEnd = () => {
        const match = peekWindow.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
        if (match) {
            dragOriginX = parseFloat(match[1]);
            dragOriginY = parseFloat(match[2]);
        }
        cancelDrag();
    };

    header.onpointerdown = (e) => {
        if (e.target.closest("button")) return;
        e.preventDefault();
        header.setPointerCapture(e.pointerId);

        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const match = peekWindow.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
        dragOriginX = match ? parseFloat(match[1]) : 0;
        dragOriginY = match ? parseFloat(match[2]) : 0;

        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";

        header.addEventListener("pointermove", onDragMove);
        header.addEventListener("pointerup", onDragEnd);
    };

    // Resize via drag on the handle
    const handle = overlay.querySelector("#peek-resize-handle");
    let resizeStartX, resizeStartY, resizeStartW, resizeStartH;

    const cancelResize = () => {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        handle.removeEventListener("pointermove", onResizeMove);
        handle.removeEventListener("pointerup", onResizeEnd);
    };

    const onResizeMove = (ev) => {
        const w = Math.max(300, resizeStartW + (ev.clientX - resizeStartX));
        const h = Math.max(200, resizeStartH + (ev.clientY - resizeStartY));
        peekWindow.style.width = w + "px";
        peekWindow.style.height = h + "px";
    };

    const onResizeEnd = () => {
        cancelResize();
    };

    handle.onpointerdown = (e) => {
        e.preventDefault();
        handle.setPointerCapture(e.pointerId);

        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
        resizeStartW = peekWindow.offsetWidth;
        resizeStartH = peekWindow.offsetHeight;

        document.body.style.cursor = "nwse-resize";
        document.body.style.userSelect = "none";

        handle.addEventListener("pointermove", onResizeMove);
        handle.addEventListener("pointerup", onResizeEnd);
    };

    // Cleanup interactions whenever the overlay is removed
    const origRemove = overlay.remove.bind(overlay);
    overlay.remove = () => {
        cancelResize();
        cancelDrag();
        origRemove();
    };
});