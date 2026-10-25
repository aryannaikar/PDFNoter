import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Offline PDF Study Reader E2E Flow', () => {
  test('Complete workflow: open PDF, add hidden page note, click marker to reveal, edit, bookmark, and persist', async ({ page }) => {
    // 1. Open app
    await page.goto('/');
    await expect(page).toHaveTitle(/Offline PDF Study Reader/);
    await expect(page.getByRole('heading', { name: 'Offline PDF Study Reader' })).toBeVisible();

    // 2. Select and upload test PDF
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Select PDF File' }).click();
    const fileChooser = await fileChooserPromise;
    const testPdfPath = path.resolve(__dirname, '../tests/fixtures/sample.pdf');
    await fileChooser.setFiles(testPdfPath);

    // 3. Wait for PDF Reader screen to render
    await expect(page.getByText('sample.pdf')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#page-container-1')).toBeVisible();

    // 4. Add page note
    await page.getByRole('button', { name: 'Add page note' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.fill('#note-title', 'Quantum Wave Function');
    await page.fill('#note-content', 'Probability density distribution for quantum particle.');
    await page.fill('#note-source-url', 'https://en.wikipedia.org/wiki/Wave_function');
    await page.getByRole('button', { name: 'Save Note' }).click();

    // 5. Verify that note is initially HIDDEN and only marker is visible
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('Probability density distribution for quantum particle.')).not.toBeVisible();

    // The marker badge should be visible on page 1
    const noteMarker = page.locator('#page-container-1').getByRole('button', { name: /Open note: Quantum Wave Function/i });
    await expect(noteMarker).toBeVisible();

    // 6. Click marker to reveal the note card
    await noteMarker.click();
    const noteCard = page.locator('div[role="region"][aria-label="Note card details"]');
    await expect(noteCard).toBeVisible();
    await expect(noteCard.getByText('Quantum Wave Function')).toBeVisible();
    await expect(noteCard.getByText('Probability density distribution for quantum particle.')).toBeVisible();
    await expect(noteCard.getByText('https://en.wikipedia.org/wiki/Wave_function')).toBeVisible();

    // 7. Edit note
    await noteCard.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.fill('#note-title', 'Quantum Wave Function (Revised)');
    await page.getByRole('button', { name: 'Save Note' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Reopen marker to verify updated title
    const updatedMarker = page.locator('#page-container-1').getByRole('button', { name: /Quantum Wave Function \(Revised\)/i });
    await expect(updatedMarker).toBeVisible();
    await updatedMarker.click();
    await expect(noteCard.getByText('Quantum Wave Function (Revised)')).toBeVisible();

    // Close note card
    await page.locator('div[role="region"][aria-label="Note card details"]').getByRole('button', { name: 'Close note popover' }).click();
    await expect(page.locator('div[role="region"][aria-label="Note card details"]')).not.toBeVisible();

    // 8. Add Bookmark
    await page.getByRole('button', { name: 'Bookmarks' }).click();
    await expect(page.getByRole('heading', { name: 'Bookmarks' })).toBeVisible();
    await page.getByRole('button', { name: /Bookmark Page 1/i }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'Delete bookmark' })).toBeVisible();
    await page.getByRole('button', { name: 'Close bookmarks' }).click();

    // 9. Back to library and verify persistence
    await page.getByRole('button', { name: 'Back to library' }).click();
    await expect(page.getByRole('heading', { name: 'Recent Documents' })).toBeVisible();
    await expect(page.getByText('sample.pdf')).toBeVisible();
    await expect(page.getByText('1 note')).toBeVisible();
  });
});
