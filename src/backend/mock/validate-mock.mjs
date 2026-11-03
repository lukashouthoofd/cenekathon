import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const mock = JSON.parse(readFileSync(join(here, 'internal-bank.json'), 'utf8'))

function fail(message) {
  console.error(message)
  process.exit(1)
}

const { from, to } = mock.period
const departments = new Map(mock.departments.map((d) => [d.name, d]))
const skills = new Map(mock.skills_inventory.map((s) => [s.skillId, s]))

// 1. Skill coverage consistency: employees_with_skill / headcount ~= internal_coverage
for (const skill of mock.skills_inventory) {
  if (skill.internal_coverage === null) continue
  const dept = departments.get(skill.department)
  if (!dept) fail(`skill ${skill.skillId}: unknown department ${skill.department}`)
  if (!Number.isInteger(skill.employees_with_skill)) {
    fail(`skill ${skill.skillId}: employees_with_skill must be an integer when coverage is set`)
  }
  const ratio = skill.employees_with_skill / dept.headcount
  if (Math.abs(ratio - skill.internal_coverage) > 0.01) {
    fail(`skill ${skill.skillId}: ${skill.employees_with_skill}/${dept.headcount} = ${ratio.toFixed(4)} != internal_coverage ${skill.internal_coverage}`)
  }
}

// 2. employees_with_ai_tool_use_90d <= headcount
for (const dept of mock.departments) {
  const n = dept.employees_with_ai_tool_use_90d
  if (n === null) continue
  if (n > dept.headcount) {
    fail(`department ${dept.name}: employees_with_ai_tool_use_90d (${n}) > headcount (${dept.headcount})`)
  }
}

// 3. Training dates within the period
for (const rec of mock.training_records) {
  if (rec.completed_on < from || rec.completed_on > to) {
    fail(`training ${rec.employee_anon_id}: completed_on ${rec.completed_on} outside ${from}..${to}`)
  }
}

// 4. Every skill_id in training_records exists in skills_inventory
for (const rec of mock.training_records) {
  if (rec.skill_id === null) continue
  if (!skills.has(rec.skill_id)) {
    fail(`training ${rec.employee_anon_id}: unknown skill_id ${rec.skill_id}`)
  }
}

console.log('mock ok')
