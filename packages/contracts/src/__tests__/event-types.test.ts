import { describe, it, expect } from 'vitest';
import {
  EVENT_TYPES,
  AGENT_EVENTS,
  MESSAGE_EVENTS,
  TOOL_EVENTS,
  ARTIFACT_EVENTS,
  KNOWLEDGE_EVENTS,
  SKILL_EVENTS,
  AUDIT_EVENTS,
  SYSTEM_EVENTS,
  ORCHESTRATOR_EVENTS,
} from '../event-types.js';

const ALL_NAMESPACE_GROUPS = [
  AGENT_EVENTS,
  MESSAGE_EVENTS,
  TOOL_EVENTS,
  ARTIFACT_EVENTS,
  KNOWLEDGE_EVENTS,
  SKILL_EVENTS,
  AUDIT_EVENTS,
  SYSTEM_EVENTS,
  ORCHESTRATOR_EVENTS,
] as const;

describe('Event Types', () => {
  describe('EVENT_TYPES', () => {
    it('should have unique values across all event types', () => {
      const values = Object.values(EVENT_TYPES);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });

    it('should follow the dot.separated.namespace convention', () => {
      const values = Object.values(EVENT_TYPES);
      for (const value of values) {
        // Convention: category.action or category.subcategory.action
        // Segments may contain underscores (e.g., tool_use, tool_result)
        expect(value).toMatch(/^[a-z]+(\.[a-z_]+){1,2}$/);
      }
    });

    it('should have corresponding namespace arrays for each category', () => {
      expect(AGENT_EVENTS.length).toBeGreaterThan(0);
      expect(MESSAGE_EVENTS.length).toBeGreaterThan(0);
      expect(TOOL_EVENTS.length).toBeGreaterThan(0);
      expect(ARTIFACT_EVENTS.length).toBeGreaterThan(0);
      expect(KNOWLEDGE_EVENTS.length).toBeGreaterThan(0);
      expect(SKILL_EVENTS.length).toBeGreaterThan(0);
      expect(AUDIT_EVENTS.length).toBeGreaterThan(0);
      expect(SYSTEM_EVENTS.length).toBeGreaterThan(0);
    });
  });

  describe('namespace groupings', () => {
    it('AGENT_EVENTS should contain only agent.* events', () => {
      for (const event of AGENT_EVENTS) {
        expect(event).toMatch(/^agent\./);
      }
    });

    it('MESSAGE_EVENTS should contain only message.* events', () => {
      for (const event of MESSAGE_EVENTS) {
        expect(event).toMatch(/^message\./);
      }
    });

    it('TOOL_EVENTS should contain only tool.* events', () => {
      for (const event of TOOL_EVENTS) {
        expect(event).toMatch(/^tool\./);
      }
    });

    it('all event types should belong to exactly one namespace group', () => {
      const allValues = Object.values(EVENT_TYPES);
      const grouped = new Set(ALL_NAMESPACE_GROUPS.flat());
      expect(grouped.size).toBe(allValues.length);

      for (const value of allValues) {
        expect(grouped.has(value)).toBe(true);
      }
    });

    it('no event type should appear in more than one namespace group', () => {
      const seen = new Set<string>();
      for (const group of ALL_NAMESPACE_GROUPS) {
        for (const event of group) {
          expect(seen.has(event)).toBe(false);
          seen.add(event);
        }
      }
    });
  });
});
