import type {
  ConfigurableProblemRule,
  GridExpressionGroupDefinition,
  GridExpressionObjectDefinition,
  GridExpressionProblemDefinition,
  ProblemRuleDefinition,
  StageId,
} from '../../game/types';

interface StageProblemJson {
  problem?: GridExpressionProblemDefinition;
  problems?: GridExpressionProblemDefinition[];
}

const stageProblemJsonModules = import.meta.glob<StageProblemJson>('./*/*.json', {
  eager: true,
  import: 'default',
});

const gridExpressionProblems = Object.values(stageProblemJsonModules)
  .flatMap((module) => getProblemsFromJsonModule(module))
  .filter(isGridExpressionProblemDefinition)
  .sort((left, right) => left.stageId.localeCompare(right.stageId) || left.problemNo - right.problemNo);

const gridExpressionProblemsByStageId = new Map<StageId, GridExpressionProblemDefinition[]>();

gridExpressionProblems.forEach((problem) => {
  const stageProblems = gridExpressionProblemsByStageId.get(problem.stageId) ?? [];
  stageProblems.push(problem);
  gridExpressionProblemsByStageId.set(problem.stageId, stageProblems);
});

/** Pulls one or many grid problems from a JSON module. */
function getProblemsFromJsonModule(module: StageProblemJson): GridExpressionProblemDefinition[] {
  return [
    module.problem,
    ...(Array.isArray(module.problems) ? module.problems : []),
  ].filter((problem): problem is GridExpressionProblemDefinition => Boolean(problem));
}

/** Checks whether loaded JSON has the minimum shape for a grid expression problem. */
function isGridExpressionProblemDefinition(value: GridExpressionProblemDefinition): boolean {
  return (
    value.kind === 'gridExpression'
    && typeof value.id === 'string'
    && typeof value.stageId === 'string'
    && Number.isInteger(value.problemNo)
    && Number.isInteger(value.grid?.cols)
    && Number.isInteger(value.grid?.rows)
    && Array.isArray(value.chars)
    && Array.isArray(value.objects)
    && typeof value.expression === 'string'
    && Number.isFinite(value.answer)
  );
}

/** Copies a grid problem so callers can render without mutating source data. */
function cloneGridExpressionProblem(problem: GridExpressionProblemDefinition): GridExpressionProblemDefinition {
  return {
    ...problem,
    grid: { ...problem.grid },
    chars: [...problem.chars],
    objects: problem.objects.map(cloneGridExpressionObject),
    groups: problem.groups?.map(cloneGridExpressionGroup),
  };
}

/** Copies a single grid object definition. */
function cloneGridExpressionObject(object: GridExpressionObjectDefinition): GridExpressionObjectDefinition {
  return { ...object };
}

/** Copies a single grid group definition. */
function cloneGridExpressionGroup(group: GridExpressionGroupDefinition): GridExpressionGroupDefinition {
  return {
    ...group,
    cells: group.cells?.map((cell) => ({ ...cell })),
  };
}

/** Finds all grid expression problems for one stage id. */
export function getStageGridExpressionProblems(stageId: StageId): GridExpressionProblemDefinition[] {
  return (gridExpressionProblemsByStageId.get(stageId) ?? []).map(cloneGridExpressionProblem);
}

/** Finds one grid expression problem by stage id and problem number. */
export function getStageGridExpressionProblem(
  stageId: StageId,
  problemNo: number,
): GridExpressionProblemDefinition | undefined {
  const problem = gridExpressionProblemsByStageId.get(stageId)
    ?.find((entry) => entry.problemNo === problemNo);
  return problem ? cloneGridExpressionProblem(problem) : undefined;
}

/** Gets every monster id referenced by one problem rule definition. */
export function getStageProblemMonsterIdsForProblemRule(problemRule: ProblemRuleDefinition): string[] {
  const monsterIds = new Set<string>();
  getGridExpressionStageIdsForProblemRule(problemRule).forEach((stageId) => {
    getStageGridExpressionProblems(stageId)
      .forEach((problem) => problem.chars.forEach((monsterId) => monsterIds.add(monsterId)));
  });

  return [...monsterIds];
}

/** Reads grid expression stage ids from legacy or structured problem rules. */
function getGridExpressionStageIdsForProblemRule(problemRule: ProblemRuleDefinition): StageId[] {
  if (typeof problemRule === 'string') {
    return [];
  }

  const rules = Array.isArray(problemRule) ? problemRule : [problemRule];
  return rules
    .filter(isGridExpressionRule)
    .map((rule) => rule.stageProblemStageId)
    .filter((stageId): stageId is StageId => Boolean(stageId));
}

/** Checks whether a structured problem rule points at grid expression data. */
function isGridExpressionRule(rule: ConfigurableProblemRule): boolean {
  return rule.kind === 'gridExpression' && Boolean(rule.stageProblemStageId);
}
