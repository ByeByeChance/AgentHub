import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from '../../../components/chat/message-bubble';
import type { Message } from '@/store/interfaces';

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    conversationId: 'c1',
    role: 'assistant',
    parts: [{ type: 'text', content: 'Hello!' }],
    status: 'complete',
    createdAt: '2026-06-25T10:00:00.000Z',
    ...overrides,
  };
}

describe('MessageBubble', () => {
  it('should render assistant message text', () => {
    render(<MessageBubble message={makeMessage({ parts: [{ type: 'text', content: 'Hello World' }] })} />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('should render user message text', () => {
    render(<MessageBubble message={makeMessage({ role: 'user', parts: [{ type: 'text', content: 'Hi!' }] })} />);
    expect(screen.getByText('Hi!')).toBeInTheDocument();
  });

  it('should show robot avatar for assistant', () => {
    render(<MessageBubble message={makeMessage({ role: 'assistant' })} />);
    expect(screen.getByText('🤖')).toBeInTheDocument();
  });

  it('should show user avatar for user messages', () => {
    render(<MessageBubble message={makeMessage({ role: 'user' })} />);
    expect(screen.getByText('👤')).toBeInTheDocument();
  });

  it('should handle streaming status without crash', () => {
    render(<MessageBubble message={makeMessage({ status: 'streaming', parts: [{ type: 'text', content: 'Partial...' }] })} />);
    expect(screen.getByText('Partial...')).toBeInTheDocument();
  });

  it('should handle failed status without crash', () => {
    render(<MessageBubble message={makeMessage({ status: 'failed', parts: [] })} />);
    expect(screen.getByText('🤖')).toBeInTheDocument();
  });

  it('should handle message with no parts', () => {
    render(<MessageBubble message={makeMessage({ parts: [] })} />);
    expect(screen.getByText('🤖')).toBeInTheDocument();
  });
});
