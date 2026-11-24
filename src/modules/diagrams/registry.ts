import type { DiagramStepSpec } from '../../domain/semi-essay';
import type { DiagramModuleDescriptor } from '../../contracts/diagram-module';

const DIAGRAM_MODULES: Readonly<Record<DiagramStepSpec['kind'], DiagramModuleDescriptor>> = {
  fbd: {
    kind: 'fbd',
    label: 'Sơ đồ lực (Free Body Diagram)',
    load: () => import('./FbdDiagram'),
  },
  heatmap: {
    kind: 'heatmap',
    label: 'Bản đồ nhiệt 2D',
    load: () => import('./HeatmapDiagram'),
  },
  'curve-2d': {
    kind: 'curve-2d',
    label: 'Đồ thị 2D & Miền diện tích',
    load: () => import('./Curve2dDiagram'),
  },
  'balance-flow': {
    kind: 'balance-flow',
    label: 'Biểu đồ năng lượng (LOL)',
    load: () => import('./BalanceFlowDiagram'),
  },
  'mo-diagram': {
    kind: 'mo-diagram',
    label: 'Giản đồ MO hóa trị',
    load: () => import('./MoDiagram'),
  },
  'prob-tree': {
    kind: 'prob-tree',
    label: 'Sơ đồ cây xác suất & Bayes',
    load: () => import('./ProbTreeDiagram'),
  },
  'algo-trace': {
    kind: 'algo-trace',
    label: 'Bảng truy vết & Quy hoạch động',
    load: () => import('./AlgoTraceDiagram'),
  },
  'proof-dag': {
    kind: 'proof-dag',
    label: 'Sơ đồ suy luận chứng minh',
    load: () => import('./ProofDagDiagram'),
  },
  'parsons-flow': {
    kind: 'parsons-flow',
    label: 'Khung cấu trúc mã nguồn',
    load: () => import('./ParsonsFlowDiagram'),
  },
};

export function getDiagramModule(kind: DiagramStepSpec['kind']): DiagramModuleDescriptor {
  return DIAGRAM_MODULES[kind];
}

export function getDiagramLabel(kind: DiagramStepSpec['kind']): string {
  return DIAGRAM_MODULES[kind].label;
}
