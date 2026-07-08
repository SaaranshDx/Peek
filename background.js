// Create the context menu once when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "peek",
        title: "Peek",
        contexts: ["link"]
    });
});

// Handle clicks on the context menu
chrome.contextMenus.onClicked.addListener((info, tab) => {
    console.log(info.linkUrl);
    console.log(tab.id);

    chrome.tabs.sendMessage(tab.id, {
        type: "peek",
        url: info.linkUrl
    });
});