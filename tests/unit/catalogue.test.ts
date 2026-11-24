import { expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { courseRegistry } from '../../src/infrastructure/content/catalogue';
import {
  learningContent,
  loadAllLazyCourseExercises,
  loadLessonMarkdown,
} from '../../src/infrastructure/content/learning';
import { validateContent } from '../../src/core/learning/content';
import { resolveResourceUrl } from '../../src/infrastructure/content/resource-url';

it('validates the template catalogue and any authored manifests cleanly', async () => {
  const lazyExercises = await loadAllLazyCourseExercises();
  const fullContent = {
    ...learningContent,
    exercises: [...learningContent.exercises, ...lazyExercises],
  };
  expect(() => validateContent(courseRegistry.list(), fullContent)).not.toThrow();
  for (const lesson of learningContent.lessons) {
    const markdown = await loadLessonMarkdown(lesson.id);
    expect(markdown.length).toBeGreaterThan(0);
  }
  for (const resource of learningContent.resources) {
    if (resource.assetPath) expect(existsSync('public/' + resource.assetPath)).toBe(true);
  }
  await expect(loadLessonMarkdown('unknown')).rejects.toThrow();
});

it('resolves Unicode PDF assets at a repository subpath with 1-based page references', () => {
  const resource = {
    id: 'pdf',
    title: 'PDF',
    kind: 'pdf' as const,
    assetPath: 'assets/vật lý/Bài 1.pdf',
    pages: [2],
    provenance: {
      repository: 'https://github.com/a/b',
      revision: 'a'.repeat(40),
      path: 'x',
      rights: 'approved' as const,
    },
  };
  expect(resolveResourceUrl(resource, '/HUS_learning_HUB/')).toBe(
    '/HUS_learning_HUB/assets/v%E1%BA%ADt%20l%C3%BD/B%C3%A0i%201.pdf#page=2',
  );
});
