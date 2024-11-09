import { useFlowEventListener } from '@speechmatics/flow-client-react';
import { useState, useRef } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  status?: 'speaking' | 'complete';
  promptId?: string;
  messageId?: string;
}

interface AssistantMessage {
  message: string;
  content?: string;
  prompt?: {
    id: string;
    response: string;
  };
  messageId?: string;
}

type FlowMessageType =
  | 'ResponseCompleted'
  | 'ConversationStarted'
  | 'AudioAdded'
  | 'ResponseStarted'
  | 'ResponseInterrupted'
  | 'AddTranscript'
  | 'AddPartialTranscript'
  | 'ConversationEnding'
  | 'ConversationEnded'
  | 'Info'
  | 'Warning'
  | 'Error'
  | 'prompt';

interface TranscriptMetadata {
  transcript: string;
}

interface FlowClientIncomingMessage {
  message: FlowMessageType;
  metadata?: TranscriptMetadata;
  content?: string;
  prompt?: {
    id: string;
    response: string;
  };
  messageId?: string;
}

export function TranscriptView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentPartial, setCurrentPartial] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isNewUtterance = useRef(true);
  const currentUtteranceText = useRef('');
  const lastProcessedTimestamp = useRef(Date.now());
  const currentMessageBuffer = useRef('');

  const cleanText = (text: string): string => {
    return text.trim().replace(/\s+/g, ' ');
  };

  const isValidText = (text: string): boolean => {
    const cleaned = cleanText(text);
    return cleaned.length > 0 && cleaned !== '.' && !cleaned.match(/^\s*$/);
  };

  const handleAssistantMessage = (data: AssistantMessage) => {
    console.log('Processing Assistant Message:', {
      messageType: data.message,
      content: data.content,
      prompt: data.prompt,
      messageId: data.messageId,
      timestamp: new Date().toISOString()
    });

    const cleanedText = cleanText(
      data.message === 'prompt' ? data.prompt?.response || '' : data.content || ''
    );

    if (!isValidText(cleanedText)) {
      console.log('Invalid assistant message text:', {
        cleanedText,
        originalData: data,
        timestamp: new Date().toISOString()
      });
      return;
    }

    setMessages(prev => {
      const existingMessage = prev.find(msg =>
        msg.role === 'assistant' && (
          (data.prompt?.id && msg.promptId === data.prompt.id) ||
          (data.messageId && msg.messageId === data.messageId) ||
          msg.status === 'speaking'
        )
      );

      const isCompleted = data.message === 'ResponseCompleted';

      console.log('Message Update State:', {
        existingMessage: existingMessage ? {
          id: existingMessage.id,
          text: existingMessage.text,
          status: existingMessage.status
        } : null,
        newText: cleanedText,
        isCompleted,
        timestamp: new Date().toISOString()
      });

      if (existingMessage) {
        return prev.map(msg =>
          msg === existingMessage
            ? {
              ...msg,
              text: cleanedText,
              promptId: data.prompt?.id || msg.promptId,
              messageId: data.messageId || msg.messageId,
              status: isCompleted ? 'complete' : 'speaking'
            }
            : msg
        );
      }

      return [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: cleanedText,
        timestamp: Date.now(),
        status: isCompleted ? 'complete' : 'speaking',
        promptId: data.prompt?.id,
        messageId: data.messageId
      }];
    });
  };

  const addOrUpdateUserMessage = (text: string, forceNew: boolean = false) => {
    setMessages(prev => {
      const currentTime = Date.now();
      const lastMessage = prev[prev.length - 1];
      const timeSinceLastMessage = currentTime - (lastMessage?.timestamp || 0);

      // Only merge messages if they're from the user and within a short timeframe
      if (!forceNew &&
        lastMessage?.role === 'user' &&
        timeSinceLastMessage < 2000) {
        // Don't update if the new text is shorter than the existing text
        if (text.length <= lastMessage.text.length) {
          return prev;
        }

        return prev.map((msg, index) =>
          index === prev.length - 1 ? { ...msg, text } : msg
        );
      }

      return [...prev, {
        id: `user-${currentTime}`,
        role: 'user',
        text,
        timestamp: currentTime
      }];
    });
  };

  useFlowEventListener('message', ({ data }: { data: FlowClientIncomingMessage; }) => {
    const messageType = data.message;

    switch (messageType) {
      case 'AddPartialTranscript': {
        const cleanedText = cleanText(data.metadata?.transcript || '');
        if (isValidText(cleanedText)) {
          console.log('Partial Transcript Processing:', {
            raw: data.metadata?.transcript,
            cleaned: cleanedText,
            currentBuffer: currentMessageBuffer.current,
            timestamp: new Date().toISOString()
          });
          setCurrentPartial(cleanedText);
          currentMessageBuffer.current = cleanedText;
        }
        break;
      }

      case 'AddTranscript': {
        const cleanedText = cleanText(data.metadata?.transcript || '');
        console.log('Full Transcript Processing:', {
          raw: data.metadata?.transcript,
          cleaned: cleanedText,
          currentBuffer: currentMessageBuffer.current,
          isValid: isValidText(cleanedText)
        });

        if (!isValidText(cleanedText)) break;

        const currentTime = Date.now();
        const timeSinceLastProcess = currentTime - lastProcessedTimestamp.current;

        // Only use the buffer if it's longer than the current fragment
        const textToAdd = currentMessageBuffer.current.length > cleanedText.length
          ? currentMessageBuffer.current
          : cleanedText;

        // Check for sentence ending in the actual fragment, not the buffer
        const isEndOfSentence = Boolean(cleanedText.match(/[.!?]$/));
        const isLongPause = timeSinceLastProcess > 1500;
        const shouldCreateNewMessage = isEndOfSentence || isLongPause;

        console.log('Message Creation Decision:', {
          textToAdd,
          fragmentText: cleanedText,
          isEndOfSentence,
          isLongPause,
          shouldCreateNewMessage,
          bufferLength: currentMessageBuffer.current.length,
          fragmentLength: cleanedText.length
        });

        if (textToAdd) {
          // Only create/update message if we have meaningful text
          if (shouldCreateNewMessage) {
            // Create new message
            addOrUpdateUserMessage(textToAdd, true);
            currentMessageBuffer.current = '';
          } else {
            // Update existing message
            addOrUpdateUserMessage(textToAdd, false);
          }
        }

        setCurrentPartial('');
        lastProcessedTimestamp.current = currentTime;
        break;
      }

      case 'ResponseStarted':
        console.log('Assistant Response Started:', {
          content: data.content,
          prompt: data.prompt,
          messageId: data.messageId,
          timestamp: new Date().toISOString()
        });
        handleAssistantMessage(data);
        break;

      case 'ResponseCompleted':
        console.log('Assistant Response Completed:', {
          content: data.content,
          prompt: data.prompt,
          messageId: data.messageId,
          timestamp: new Date().toISOString()
        });
        handleAssistantMessage(data);
        break;

      case 'ResponseInterrupted':
        console.log('Assistant Response Interrupted:', {
          content: data.content,
          prompt: data.prompt,
          messageId: data.messageId,
          timestamp: new Date().toISOString()
        });
        handleAssistantMessage(data);
        break;

      case 'prompt':
        console.log('Prompt Received:', {
          content: data.content,
          prompt: data.prompt,
          messageId: data.messageId,
          timestamp: new Date().toISOString()
        });
        handleAssistantMessage(data);
        break;

      default:
    }
  });

  return (
    <div className="flex flex-col space-y-4 p-4 max-h-[600px] overflow-y-auto bg-gray-50 rounded-lg">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}
        >
          <div
            className={`max-w-[80%] rounded-lg p-3 shadow-sm ${message.role === 'assistant'
              ? 'bg-white border border-gray-200'
              : 'bg-blue-500 text-white'
              } ${message.status === 'speaking' ? 'animate-pulse' : ''}`}
          >
            <p className="text-sm whitespace-pre-wrap">{message.text}</p>
            <div className="text-xs mt-2 space-y-1">
              <p className={message.role === 'assistant' ? 'text-gray-400' : 'text-blue-100'}>
                {new Date(message.timestamp).toLocaleTimeString()}
              </p>
              {message.promptId && (
                <p className="font-mono text-gray-400">ID: {message.promptId}</p>
              )}
            </div>
          </div>
        </div>
      ))}

      {currentPartial && messages.length === 0 && (
        <div className="flex justify-end">
          <div className="max-w-[80%] bg-blue-500 text-white rounded-lg p-3 shadow-sm opacity-70">
            <p className="text-sm whitespace-pre-wrap">{currentPartial}</p>
            <p className="text-xs text-blue-100 mt-2">Role: user (partial)</p>
          </div>
        </div>
      )}

      {!currentPartial && messages.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          Start speaking to begin the conversation.
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}