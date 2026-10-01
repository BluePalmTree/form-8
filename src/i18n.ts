import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const de = {
  app: { title: 'Choreo-Planer' },
  common: { undo: 'Rückgängig', redo: 'Wiederholen', language: 'Sprache' },
  choreo: { name: 'Name der Choreografie', default: 'Neue Choreografie' },
  play: { multiSelect: 'Mehrfachauswahl', play: 'Abspielen', pause: 'Stopp', prev: 'Vorherige Formation', next: 'Nächste Formation' },
  formation: {
    title: 'Formationen',
    default: 'Formation {{n}}',
    add: 'Kopie hinzufügen',
    remove: 'Löschen',
    left: 'Nach links',
    right: 'Nach rechts',
    name: 'Name',
    duration: 'Übergang (Takte)',
    hold: 'Halten (Takte)',
    pathStyle: 'Wege',
    note: 'Notiz',
    notePlaceholder: 'Hinweise zu dieser Formation, z. B. Zählzeiten oder Armbewegungen',
    resetCurves: 'Eigene Kurven zurücksetzen',
    tempo: 'Tempo (BPM)',
    progress: '{{pos}} / {{total}} Takte',
  },
  pathStyle: { straight: 'Gerade', out: 'Bogen nach außen', in: 'Bogen nach innen' },
  timing: {
    title: 'Startverzögerung',
    hint: 'Tänzer auswählen (in der gewünschten Reihenfolge), um sie zeitlich zu staffeln.',
    start: 'Start (Takt)',
    length: 'Laufzeit (Takte)',
    gap: 'Abstand (Takte)',
    needed: 'Braucht {{count}} von {{duration}} Takten Übergang.',
    apply: 'Auf {{count}} anwenden',
    reset: 'Zurücksetzen',
    entry: 'Takt {{from}} → {{to}}',
  },
  stage: {
    title: 'Bühne',
    width: 'Breite (m)',
    depth: 'Tiefe (m)',
    snap: 'Raster',
    snapOff: 'Aus',
    showPaths: 'Wege anzeigen',
    audience: 'Publikum',
    resetWarning: 'Eigene Kurven werden beim Ändern der Bühnengröße zurückgesetzt.',
  },
  dancers: {
    title: 'Tänzer ({{count}})',
    add: '+ 1',
    add5: '+ 5',
    remove: 'Entfernen',
    name: 'Name',
    color: 'Farbe',
    selectAll: 'Alle auswählen',
    selectNone: 'Auswahl aufheben',
    hint: 'Mehrere Tänzer: Rahmen auf der Bühne aufziehen, Umschalt-Klick oder „Mehrfachauswahl“ antippen. Pfad-Punkt ziehen für Kurven, Doppelklick setzt zurück.',
  },
  share: {
    title: 'Teilen',
    current: 'Aktuelles Bild',
    all: 'Alle Bilder',
    failed: 'Bild konnte nicht erstellt werden.',
  },
  library: {
    title: 'Choreografien',
    new: 'Neu',
    delete: 'Löschen',
    confirmDelete: 'Diese Choreografie wirklich löschen?',
    export: 'Exportieren',
    import: 'Importieren',
    importError: 'Die Datei ist keine gültige Choreografie.',
  },
}

const en: typeof de = {
  app: { title: 'Choreo Planner' },
  common: { undo: 'Undo', redo: 'Redo', language: 'Language' },
  choreo: { name: 'Choreography name', default: 'New choreography' },
  play: { multiSelect: 'Multi-select', play: 'Play', pause: 'Stop', prev: 'Previous formation', next: 'Next formation' },
  formation: {
    title: 'Formations',
    default: 'Formation {{n}}',
    add: 'Add copy',
    remove: 'Delete',
    left: 'Move left',
    right: 'Move right',
    name: 'Name',
    duration: 'Transition (counts)',
    hold: 'Hold (counts)',
    pathStyle: 'Paths',
    note: 'Note',
    notePlaceholder: 'Notes for this formation, e.g. counts or arm movements',
    resetCurves: 'Reset custom curves',
    tempo: 'Tempo (BPM)',
    progress: '{{pos}} / {{total}} counts',
  },
  pathStyle: { straight: 'Straight', out: 'Bow outward', in: 'Bow inward' },
  timing: {
    title: 'Start delay',
    hint: 'Select dancers (in the order they should go) to stagger them.',
    start: 'Start (count)',
    length: 'Walking time (counts)',
    gap: 'Gap (counts)',
    needed: 'Needs {{count}} of {{duration}} counts of transition.',
    apply: 'Apply to {{count}}',
    reset: 'Reset',
    entry: 'Count {{from}} → {{to}}',
  },
  stage: {
    title: 'Stage',
    width: 'Width (m)',
    depth: 'Depth (m)',
    snap: 'Grid',
    snapOff: 'Off',
    showPaths: 'Show paths',
    audience: 'Audience',
    resetWarning: 'Custom curves are reset when the stage size changes.',
  },
  dancers: {
    title: 'Dancers ({{count}})',
    add: '+ 1',
    add5: '+ 5',
    remove: 'Remove',
    name: 'Name',
    color: 'Color',
    selectAll: 'Select all',
    selectNone: 'Clear selection',
    hint: 'Multiple dancers: drag a box on the stage, Shift-click or turn on “Multi-select”. Drag a path point to curve it, double-click to reset.',
  },
  share: {
    title: 'Share',
    current: 'Current image',
    all: 'All images',
    failed: 'Could not create the image.',
  },
  library: {
    title: 'Choreographies',
    new: 'New',
    delete: 'Delete',
    confirmDelete: 'Really delete this choreography?',
    export: 'Export',
    import: 'Import',
    importError: 'The file is not a valid choreography.',
  },
}

const LANG_KEY = 'form8:lang'

function storedLang(): 'de' | 'en' {
  try {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'de'
  } catch {
    return 'de'
  }
}

void i18n.use(initReactI18next).init({
  resources: { de: { translation: de }, en: { translation: en } },
  lng: storedLang(),
  fallbackLng: 'de',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
  try {
    localStorage.setItem(LANG_KEY, lng)
  } catch {
    /* ignore */
  }
})
document.documentElement.lang = i18n.language

export default i18n
