import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@mui/material';
import { ChatMessage } from './types';

const ASSISTANT_DELAY_MS = 550;
const OTHER_DELAY_MS = 150;

/**
 * Reveals messages one at a time so the conversation arrives rather than
 * appearing all at once.
 *
 * The one rule worth stating: nothing the user has already done is replayed.
 * Someone resuming setup should not sit through their own past answers being
 * typed back at them, so a transcript that already contains history is shown
 * at once and only later additions are paced. A transcript that opens from
 * scratch has no history to skip, so it is paced from the first line.
 */
export const useRevealedMessages = (messages: ChatMessage[], animateInitial: boolean) => {
  const [revealedIds, setRevealedIds] = useState<string[]>([]);
  const [typing, setTyping] = useState(false);
  const seeded = useRef(false);
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  useEffect(() => {
    if (messages.length === 0) return;

    if (!seeded.current) {
      seeded.current = true;
      if (!animateInitial) {
        setRevealedIds(messages.map((message) => message.id));
        return;
      }
    }

    const known = new Set(revealedIds);
    const next = messages.find((message) => !known.has(message.id));
    if (!next) {
      setTyping(false);
      return;
    }

    if (reduceMotion) {
      setRevealedIds((previous) => [...previous, next.id]);
      return;
    }

    // Only an assistant line is worth a typing pause. A card or the echo of
    // something the user just did should follow immediately - they are not
    // being composed by anyone.
    const isThinking = next.kind === 'assistant';
    setTyping(isThinking);

    const timer = setTimeout(
      () => {
        setTyping(false);
        setRevealedIds((previous) => [...previous, next.id]);
      },
      isThinking ? ASSISTANT_DELAY_MS : OTHER_DELAY_MS
    );

    return () => clearTimeout(timer);
  }, [messages, revealedIds, reduceMotion, animateInitial]);

  const revealed = new Set(revealedIds);
  return {
    visible: messages.filter((message) => revealed.has(message.id)),
    typing
  };
};
