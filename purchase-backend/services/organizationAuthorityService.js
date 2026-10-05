const defaultRepository = require('../repositories/organizationRepository');

const dateOnly = value => value instanceof Date ? value.toISOString().slice(0, 10) : value ? String(value).slice(0, 10) : null;
const isCurrentPosition = (position, today = new Date().toISOString().slice(0, 10)) =>
  position.is_active === true &&
  (!position.effective_from || dateOnly(position.effective_from) <= dateOnly(today)) &&
  (!position.effective_to || dateOnly(position.effective_to) >= dateOnly(today));

const unassigned = extra => ({ status: 'UNASSIGNED', ...extra });
const ambiguous = extra => ({ status: 'AMBIGUOUS', ...extra });
const serializePosition = (position, extra = {}) => ({
  status: 'RESOLVED',
  positionId: position.id,
  organizationUnitId: position.organization_unit_id,
  positionType: position.position_type,
  positionName: position.position_name,
  userId: position.user_id,
  userName: position.user_name,
  userEmail: position.user_email,
  isUnitHead: position.is_unit_head,
  isActive: position.is_active,
  effectiveFrom: position.effective_from,
  effectiveTo: position.effective_to,
  ...extra
});

function createOrganizationAuthorityService(repo = defaultRepository) {
  const scopedUnit = async (unitId, instituteId, client) => {
    const unit = await repo.get(unitId, client);
    return unit && unit.is_active !== false && String(unit.institute_id) === String(instituteId) ? unit : null;
  };

  const resolveMatches = (matches, extra = {}) => {
    if (!matches.length) return unassigned(extra);
    if (matches.length > 1) return ambiguous({ ...extra, positionIds: matches.map(position => position.id) });
    const position = matches[0];
    const holderActivityKnown = Object.prototype.hasOwnProperty.call(position, 'user_is_active');
    if (position.user_id == null || (holderActivityKnown && position.user_is_active !== true)) {
      return unassigned({ ...extra, positionId: position.id, positionType: position.position_type });
    }
    return serializePosition(position, extra);
  };

  const currentPositions = async (unitId, instituteId, client) => {
    if (!await scopedUnit(unitId, instituteId, client)) return [];
    return (await repo.positions(unitId, client, instituteId)).filter(position => isCurrentPosition(position));
  };

  const resolveUnitHead = async (unitId, instituteId, client) =>
    resolveMatches((await currentPositions(unitId, instituteId, client)).filter(position => position.is_unit_head === true), { organizationUnitId: unitId });

  const resolveUnitHeadByCode = async (code, instituteId, client) => {
    const units = await repo.findByCode(code, instituteId, client);
    if (!units.length) return unassigned({ organizationUnitCode: code });
    if (units.length > 1) return ambiguous({
      organizationUnitCode: code,
      organizationUnitIds: units.map(unit => unit.id)
    });
    return resolveUnitHead(units[0].id, instituteId, client);
  };

  const resolveTypedPosition = async (unitId, positionType, instituteId, client) =>
    resolveMatches((await currentPositions(unitId, instituteId, client)).filter(position => position.position_type === positionType), { organizationUnitId: unitId });

  const resolveExecutiveOwner = async (unitId, instituteId, client) => {
    const unit = await scopedUnit(unitId, instituteId, client);
    if (!unit) return unassigned({ organizationUnitId: null });
    const ancestors = await repo.ancestors(unitId, client);
    if (ancestors.some(item => String(item.institute_id) !== String(instituteId))) return unassigned({ organizationUnitId: null });
    const executiveUnit = [unit, ...ancestors.slice().reverse()].find(item => item.unit_type === 'EXECUTIVE_OFFICE');
    if (!executiveUnit) return unassigned({ organizationUnitId: null });
    return resolveMatches(
      (await currentPositions(executiveUnit.id, instituteId, client)).filter(position => position.position_type === 'EXECUTIVE_HEAD'),
      { organizationUnitId: executiveUnit.id, organizationUnitName: executiveUnit.name }
    );
  };

  return { currentPositions, resolveUnitHead, resolveUnitHeadByCode, resolveTypedPosition, resolveExecutiveOwner, isCurrentPosition };
}

module.exports = { createOrganizationAuthorityService, isCurrentPosition, serializePosition };
