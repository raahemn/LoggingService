import { h } from "preact";
import { useState, useRef, useEffect } from "preact/hooks";
import "ojs/ojpopup";
import "ojs/ojinputtext";
import "oj-c/button";
import "oj-c/input-text";
import { useChatbot } from "../hooks/useChatbot";
import { useStarredMessages } from "../hooks/useStarredMessages";
import { formatMarkdownText } from "../utils/textFormattingUtils";

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isClearing, setIsClearing] = useState(false);
  const [processedOperations, setProcessedOperations] = useState<Set<string>>(new Set());
  const [showStarredMessages, setShowStarredMessages] = useState(false);
  const [starringMessages, setStarringMessages] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const starredDropdownRef = useRef<HTMLDivElement>(null);
  
  const { messages, loading, error, sendMessage: sendChatMessage, confirmOperation, cancelOperation, clearMessages } = useChatbot();
  const { starredMessages, loading: starredLoading, error: starredError, fetchStarredMessages, addStarredMessage, removeStarredMessage, isMessageStarred } = useStarredMessages();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is outside the entire chatbot container
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false);
        setShowStarredMessages(false);
        return;
      }
      
      // If we're here, click is inside the chatbot container
      // Check if starred dropdown is open and click is outside the dropdown
      if (showStarredMessages && starredDropdownRef.current && !starredDropdownRef.current.contains(target)) {
        // Check if the click is on the starred messages button itself
        const starButton = (event.target as Element)?.closest('oj-c-button[title="Show starred messages"]');
        if (!starButton) {
          setShowStarredMessages(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, showStarredMessages]);

  const toggleChatbot = async () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    
    // Fetch starred messages when opening the chatbot
    if (newIsOpen) {
      try {
        await fetchStarredMessages();
      } catch (error) {
        console.error('Failed to fetch starred messages:', error);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    
    const message = inputText;
    setInputText("");
    await sendChatMessage(message);
  };

  const handleKeyPress = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleConfirmOperation = async (operationId: string) => {
    if (processedOperations.has(operationId)) return;
    setProcessedOperations(prev => new Set(prev).add(operationId));
    await confirmOperation(operationId);
  };

  const handleCancelOperation = async (operationId: string) => {
    if (processedOperations.has(operationId)) return;
    setProcessedOperations(prev => new Set(prev).add(operationId));
    await cancelOperation(operationId);
  };

  const handleClearMessages = async () => {
    setIsClearing(true);
    setProcessedOperations(new Set());
    setTimeout(() => {
      clearMessages();
      setIsClearing(false);
    }, 300);
  };

  const handleStarMessage = async (messageText: string) => {
    // Add to starring state
    setStarringMessages(prev => new Set(prev).add(messageText));
    
    try {
      if (isMessageStarred(messageText)) {
        await removeStarredMessage(messageText);
      } else {
        await addStarredMessage(messageText);
      }
    } catch (error) {
      console.error('Failed to toggle star:', error);
    } finally {
      // Remove from starring state after operation completes
      setStarringMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageText);
        return newSet;
      });
    }
  };

  const handleSelectStarredMessage = (message: string) => {
    setInputText(message);
    setShowStarredMessages(false);
  };

  const handleToggleStarredMessages = () => {
    setShowStarredMessages(!showStarredMessages);
  };

  const renderStarredMessagesDropdown = () => {
    if (!showStarredMessages) return null;

    return (
      <div 
        ref={starredDropdownRef}
        class="oj-panel oj-panel-shadow-lg"
        style={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          right: 0,
          maxHeight: '300px',
          zIndex: 1001,
          borderRadius: '8px',
          marginBottom: '8px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style="padding: 8px; border-bottom: 1px solid #e5e7eb; flex-shrink: 0;">
          <h6 class="oj-typography-heading-xs oj-sm-margin-0">Starred Messages</h6>
        </div>
        <div style="flex: 1; overflow-y: auto; min-height: 0;">
          {starredLoading ? (
            <div class="oj-text-secondary-color oj-text-xs" style="padding: 12px; text-align: center;">
              Loading starred messages...
            </div>
          ) : starredError ? (
            <div class="oj-text-danger oj-text-xs" style="padding: 12px; text-align: center;">
              Failed to load starred messages
            </div>
          ) : starredMessages.length === 0 ? (
            <div class="oj-text-secondary-color oj-text-xs" style="padding: 12px; text-align: center;">
              No starred messages yet
            </div>
          ) : (
            starredMessages.map((message, index) => (
              <div
                key={index}
                style="padding: 6px 8px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; gap: 4px;"
              >
                <div 
                  class="oj-clickable-icon-nocontext" 
                  style="flex: 1; cursor: pointer; word-wrap: break-word;"
                  onClick={() => handleSelectStarredMessage(message)}
                >
                  <div class="oj-text-xs oj-text-color">
                    {message}
                  </div>
                </div>
                <oj-c-button
                  display="icons"
                  chroming="borderless"
                  size="sm"
                  onojAction={(event: Event) => {
                    event.stopPropagation();
                    handleStarMessage(message);
                  }}
                  // label="Remove from starred"
                  title="Remove from starred"
                  disabled={starringMessages.has(message)}
                >
                  <span 
                    slot="startIcon" 
                    class="oj-ux-ico-close"
                    // style="color: #6b7280; font-size: 12px;"
                  ></span>
                </oj-c-button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderChatbotContent = () => (
    <div
      class="oj-panel oj-panel-shadow-lg"
      style={{
        right: 0,
        top: '100%',
        zIndex: 1000,
        display: 'flex',
        overflow: 'hidden',
        minHeight: '400px',
        maxHeight: '500px',
        borderRadius: '8px',
        position: 'absolute',
        flexDirection: 'column',
        opacity: isOpen ? 1 : 0,
        transformOrigin: 'top right',
        transition: 'all 0.15s ease-out',
        width: 'clamp(320px, 30vw, 600px)',
        transform: `scale(${isOpen ? 1 : 0})`,
      }}
    >
      {/* Header - Fixed at top */}
      <div style="flex-shrink: 0; padding: 16px; border-bottom: 1px solid #e5e7eb;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center;">
            <span class="oj-ux-ico-chat" style="margin-right: 8px; font-size: 2rem; "></span>
            <h6 class="oj-typography-heading-sm oj-sm-margin-0">AI Assistant</h6>
          </div>
          <oj-c-button
            display="icons"
            chroming="borderless"
            onojAction={handleClearMessages}
            label="Clear Chat"
            title="Clear Chat History"
            disabled={messages.length === 0 || isClearing}
          >
            <span slot="startIcon" class="oj-ux-ico-dirty-data-reset" style={isClearing ? 'transform: rotate(360deg); transition: transform 0.3s ease-in-out;' : ''} > </span>
          </oj-c-button>
        </div>
      </div>

      {/* Messages Area - Scrollable */}
      <div style="flex: 1; overflow-y: auto; padding: 16px; min-height: 0; max-height: 350px;">
        <div 
          style={`display: flex; flex-direction: column; min-height: 100%; justify-content: flex-end; transition: opacity 0.3s ease-out; opacity: ${isClearing ? 0 : 1};`}
        >
        {messages.length === 0 ? (
          <div class="oj-text-secondary-color oj-text-sm" style="text-align: center; margin: 20px 0;">
            Hi! I'm your AI assistant. How can I help you today?
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              style="margin-bottom: 16px;"
            >
              <div style={`display: flex; align-items: flex-start; gap: 8px; ${message.isUser ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}`}>
                {/* Star button for user messages - positioned on the left of user messages */}
                {message.isUser && (
                  <oj-c-button
                    display="icons"
                    chroming="borderless"
                    size="sm"
                    onojAction={() => handleStarMessage(message.text)}
                    label={isMessageStarred(message.text) ? "Unstar message" : "Star message"}
                    title={isMessageStarred(message.text) ? "Unstar message" : "Star message"}
                    disabled={starringMessages.has(message.text)}
                  >
                    <span 
                      slot="startIcon" 
                      class={(() => {
                        if (starringMessages.has(message.text)) {
                          return "oj-ux-ico-star";
                        }
                        return isMessageStarred(message.text) ? "oj-ux-ico-star-full" : "oj-ux-ico-star";
                      })()}
                      style={(() => {
                        if (starringMessages.has(message.text)) {
                          return "color: #6b7280; transform: rotate(360deg); transition: transform 0.8s linear;";
                        }
                        return isMessageStarred(message.text) ? "color: #000000ff;" : "color: #000000ff;";
                      })()}
                    ></span>
                  </oj-c-button>
                )}
                
                <div
                  class={`oj-sm-padding-2x oj-text-sm ${message.isUser
                    ? 'oj-bg-info-30 oj-color-info-contrast'
                    : 'oj-bg-neutral-20 oj-text-color'
                    }`}
                  style="display: inline-block; border-radius: 12px; max-width: 80%; word-wrap: break-word; white-space: pre-wrap;"
                >
                  {formatMarkdownText(message.text)}
                </div>
              </div>
              
              {/* Show confirmation buttons for pending operations */}
              {message.pendingOperation && (
                <div class="oj-panel" style={`margin-top: 8px; padding: 12px; border-radius: 6px; ${message.isUser ? 'margin-right: 40px;' : 'margin-left: 0;'}`}>
                  <div class="oj-flex oj-sm-align-items-center oj-sm-justify-content-space-between">
                    <span class="oj-typography-body-sm oj-text-secondary-color">
                      {processedOperations.has(message.pendingOperation.id) ? "Action completed" : "Confirmation required"}
                    </span>
                    <div class="oj-flex" style="gap: 8px;">
                      <oj-c-button
                        size="sm"
                        chroming="solid"
                        onojAction={() => handleConfirmOperation(message.pendingOperation!.id)}
                        disabled={loading || processedOperations.has(message.pendingOperation!.id)}
                        label="Confirm"
                      >
                        <span slot="startIcon" class="oj-ux-ico-check"></span>
                      </oj-c-button>
                      <oj-c-button
                        size="sm"
                        chroming="outlined"
                        onojAction={() => handleCancelOperation(message.pendingOperation!.id)}
                        disabled={loading || processedOperations.has(message.pendingOperation!.id)}
                        label="Cancel"
                      >
                        <span slot="startIcon" class="oj-ux-ico-close"></span>
                      </oj-c-button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Timestamp positioned below the message, aligned based on sender */}
              <div 
                class="oj-typography-body-2xs oj-text-tertiary-color" 
                style={`margin-top: 4px; font-size: 10px; ${message.isUser ? 'text-align: right;' : 'text-align: left;'}`}
              >
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div class="oj-text-secondary-color oj-text-sm" style="text-align: left; margin-bottom: 16px;">
            <div class="oj-bg-neutral-20 oj-text-color oj-sm-padding-2x" style="display: inline-block; border-radius: 12px;">
              AI is typing...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area - Fixed at bottom */}
      <div style="flex-shrink: 0; padding: 16px; border-top: 1px solid #e5e7eb; background: white; position: relative;">
        {renderStarredMessagesDropdown()}
        <div class="oj-flex oj-sm-align-items-center" style="gap: 8px;">
          <oj-c-button
            display="icons"
            chroming="outlined"
            onojAction={handleToggleStarredMessages}
            // label="Starred Messages"
            title="Show starred messages"
            disabled={loading}
          >
            <span slot="startIcon" class="oj-ux-ico-star" style="color: #6b7280;"></span>
          </oj-c-button>
          <oj-input-text
            value={inputText}
            onrawValueChanged={(event: any) => setInputText(event.detail.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type your message..."
            style="flex: 1;"
          />
          <oj-c-button
            onojAction={handleSendMessage}
            label="Send"
            disabled={!inputText.trim() || loading}
          >
            <span slot="startIcon" class="oj-ux-ico-send"></span>
          </oj-c-button>
        </div>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} class="oj-flex oj-sm-align-items-center oj-sm-justify-content-end" style={{ position: 'relative' }}>
      <oj-c-button
        id="chatbotTrigger"
        display="icons"
        chroming="borderless"
        onojAction={toggleChatbot}
        label="AI Assistant"
        class="oj-sm-margin-2x-end"
      >
        <span slot="startIcon" class="oj-ux-ico-artificial-intelligence"></span>
      </oj-c-button>
      {renderChatbotContent()}
    </div>
  );
}