var tid = 0;
document.getElementById('submitBtn').addEventListener('click', () => {
    const userInput = document.getElementById('userInput').value;

    // Open ChatGPT in a new tab
    chrome.tabs.create({
        url: 'https://chat.openai.com'
    }, (tab) => {
        if (chrome.runtime.lastError) {
            console.error('Error creating tab:', chrome.runtime.lastError.message);
            return;
        }

        console.log('Tab ID:', tab.id); // Log the created tab ID
        tid = tab.id;
        // Use a delay to ensure the tab is loaded before executing the script
        setTimeout(() => {
            chrome.scripting.executeScript({
                target: {
                    tabId: tab.id
                },
                func: (input) => {
                    // Find the chat input element using its attributes
                    const chatInput = document.querySelector('p[data-placeholder="Message ChatGPT"].placeholder');
                    if (chatInput) {
                        // Set the inner HTML with the user input
                        chatInput.innerHTML = input;
                        chatInput.dispatchEvent(new Event('input', {
                            bubbles: true
                        })); // Trigger input event

                        // Function to check for the send button's visibility and click it
                        const checkAndClickSendButton = () => {
                            const sendButton = document.querySelector('button[aria-label="Send prompt"][data-testid="send-button"]');
                            if (sendButton && !sendButton.disabled) {
                                sendButton.click(); // Click the send button
                                console.log('Send button clicked.');

                                // Wait for 15 seconds and check for the copy button
                                setTimeout(checkForCopyButton, 1000); // Wait for 15 seconds
                            } else {
                                console.log('Send button not ready yet, retrying...');
                                setTimeout(checkAndClickSendButton, 500); // Retry after 500ms
                            }
                        };

                        // Function to check for the copy button and click it
                        const checkForCopyButton = () => {
                            const copyButton = document.querySelector('button[aria-label="Copy"][data-testid="copy-turn-action-button"]');
                            if (copyButton) {
                                copyButton.click(); // Click the copy button
                                console.log('Copy button clicked.');

                                // Use a delay to ensure the document is focused
                                setTimeout(() => {
                                    // Now try to read from the clipboard
                                    navigator.clipboard.readText()
                                        .then((copiedText) => {
                                            console.log('Copied text:', copiedText);

                                            // Send the copied text back to the extension
                                            chrome.runtime.sendMessage({
                                                responseText: copiedText
                                            });
                                        })
                                        .catch((error) => {
                                            console.error('Failed to copy text:', error);
                                        });
                                }, 1000); // Adjust this timeout as necessary (e.g., 1000ms)
                            } else {
                                console.log('Copy button not available yet, retrying...');
                                setTimeout(checkForCopyButton, 500); // Retry after 500ms
                            }
                        };

                        // Start checking for the send button's visibility
                        checkAndClickSendButton();
                    } else {
                        console.error('Chat input not found.');
                    }
                },
                args: [userInput],
            }).catch(error => {
                console.error('Error executing script:', error);
            });
        }, 1000); // Increase to 10 seconds or more
    });
});

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.responseText) {
        const responseDiv = $('#responseDiv');

        // Update the displayed text without refreshing the extension page
        if (responseDiv.length) {
            const tempElement = $('<div>').html(message.responseText); // Use .html() to allow HTML tags

            const codeBlocks = tempElement.html().match(/```(\w+)?\n([\s\S]*?)```/g);
            let formattedResponse = '';
            let nonCodeHtml = tempElement.html(); // Store the entire HTML

            if (codeBlocks) {
                codeBlocks.forEach(codeBlock => {
                    const languageMatch = codeBlock.match(/```(\w+)?\n/);
                    const codeContent = codeBlock.replace(/```(\w+)?\n/g, '').replace(/```/g, '').trim(); // Remove backticks and language

                    // Add language name as H1
                    if (languageMatch) {
                        const languageName = languageMatch[1] || 'Code';
                        formattedResponse += `<h1 class="language-name">${languageName}</h1>`;
                    }

                    // Add formatted code block with a copy button
                    formattedResponse += `
                        <div class="code-block">
                            <pre><code>${escapeHtml(codeContent)}</code></pre>
                            <button class="copy-button" data-code="${encodeURIComponent(codeContent)}">Copy Code</button>
                        </div>
                    `;

                    // Remove code blocks from non-code HTML
                    nonCodeHtml = nonCodeHtml.replace(codeBlock, '');
                });
            }

            // Format the non-code text for better readability
            nonCodeHtml = formatMarkdown(nonCodeHtml);

            // Render the response with non-code HTML and formatted code blocks
            responseDiv.html(`
                Response from ChatGPT:
                <div class="formatted-text">${nonCodeHtml}</div>
                ${formattedResponse}
            `);

            // Attach jQuery event listener to the copy buttons
            $('.copy-button').on('click', function() {
                const codeToCopy = decodeURIComponent($(this).data('code')); // Get the code from the data attribute
                copyToClipboard(codeToCopy);
            });

            // Send message to close the ChatGPT tab after printing the response
            chrome.tabs.remove(tid, () => {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError);
                }
            });
        } else {
            console.error('Element with ID responseDiv not found.');
        }
    }
});


// Function to escape HTML characters for safe display
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Function to copy text to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        console.log('Copied to clipboard: ', text);
    }).catch(err => {
        console.error('Could not copy text: ', err);
    });
}

// Function to format text that is not within code blocks
function formatMarkdown(text) {
    // Example implementation of Markdown formatting (customize as needed)
    // Convert *bold* to <strong>bold</strong>
    text = text.replace(/\*(.*?)\*/g, '<strong>$1</strong>');

    // Convert _italic_ to <em>italic</em>
    text = text.replace(/_(.*?)_/g, '<em>$1</em>');

    // Convert [link text](url) to <a href="url">link text</a>
    text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Add additional formatting styles if desired
    text = text.replace(/\n/g, '<br>'); // Preserve line breaks

    return text; // Return the formatted text
}