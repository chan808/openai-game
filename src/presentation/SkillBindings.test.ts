import { describe, expect, it } from 'vitest';

import { SkillBindings } from './SkillBindings';

describe('SkillBindings', () => {
  it('starts with slow on Space and teleport on right click', () => {
    const bindings = new SkillBindings();

    expect(bindings.getSkill('space')).toBe('slow');
    expect(bindings.getSkill('mouseRight')).toBe('teleport');
    expect(bindings.getSkill('q')).toBeNull();
  });

  it('moves a skill into an empty slot', () => {
    const bindings = new SkillBindings();

    bindings.moveSkill('teleport', 'q');

    expect(bindings.getSkill('q')).toBe('teleport');
    expect(bindings.getSkill('mouseRight')).toBeNull();
  });

  it('swaps skills when the target slot is occupied', () => {
    const bindings = new SkillBindings();

    bindings.moveSkill('teleport', 'space');

    expect(bindings.getSkill('space')).toBe('teleport');
    expect(bindings.getSkill('mouseRight')).toBe('slow');
  });
});
