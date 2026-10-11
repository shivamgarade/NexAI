import { Skill, extractVariables } from './Skill.js';

/**
 * Backward compatibility alias: Prompt delegates to Skill model.
 */
export const Prompt = Skill;
export { extractVariables, Skill };
export default Skill;
