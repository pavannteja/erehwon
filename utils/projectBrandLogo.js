/**
 * Brand mark for dashboard cards and project overview hero (same rules in both places).
 * @param {object} campground – doc or plain object; optional populated adoptedFromCorporateProblem
 * @returns {{ kind: 'image', src: string, alt: string } | { kind: 'initial', letter: string }}
 */
function projectBrandLogo(campground) {
  if (campground && campground.isStudentLedProject) {
    return { kind: 'initial', letter: 'S' };
  }

  const corp = campground && campground.adoptedFromCorporateProblem;
  if (corp && typeof corp === 'object') {
    const name = (corp.companyName || '').trim();
    if (name && /unilever/i.test(name)) {
      return { kind: 'image', src: '/images/unilever-logo.webp', alt: `${name} logo` };
    }
    if (name) {
      return { kind: 'initial', letter: name.charAt(0).toUpperCase() };
    }
  }
  return { kind: 'image', src: '/images/mission-launch-icon.png', alt: '' };
}

module.exports = { projectBrandLogo };
