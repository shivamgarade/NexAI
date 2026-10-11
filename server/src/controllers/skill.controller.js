import * as skillService from '../services/skill.service.js';

export async function getSkills(req, res, next) {
  try {
    const filters = req.query || {};
    const skills = await skillService.getSkills(req.user._id, filters);
    res.json({ data: skills });
  } catch (err) {
    next(err);
  }
}

export async function getSkillById(req, res, next) {
  try {
    const skill = await skillService.getSkillById(req.user._id, req.params.id);
    res.json({ data: skill });
  } catch (err) {
    next(err);
  }
}

export async function createSkill(req, res, next) {
  try {
    const skill = await skillService.createSkill(req.user._id, req.body);
    res.status(201).json({ data: skill });
  } catch (err) {
    next(err);
  }
}

export async function updateSkill(req, res, next) {
  try {
    const skill = await skillService.updateSkill(req.user._id, req.params.id, req.body);
    res.json({ data: skill });
  } catch (err) {
    next(err);
  }
}

export async function deleteSkill(req, res, next) {
  try {
    await skillService.deleteSkill(req.user._id, req.params.id);
    res.json({ message: 'Skill deleted successfully' });
  } catch (err) {
    next(err);
  }
}

export async function toggleFavorite(req, res, next) {
  try {
    const skill = await skillService.toggleFavorite(req.user._id, req.params.id);
    res.json({ data: skill });
  } catch (err) {
    next(err);
  }
}
