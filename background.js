// Allows users to open the side panel by clicking on the action toolbar icon
chrome.sidePanel
    .setPanelBehavior({
        openPanelOnActionClick: true
    })
    .catch((error) => console.error(error));


// background.js

let chatGptTabId; // Variable to store the ChatGPT tab ID

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "openChatGpt") {
        // Save the tab ID of the ChatGPT tab when it is opened
        chatGptTabId = sender.tab.id;
    } else if (message.action === "closeTab") {
        // Close the ChatGPT tab when requested
        if (chatGptTabId) {
            chrome.tabs.remove(chatGptTabId, () => {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError);
                }
            });
        }
    }
});