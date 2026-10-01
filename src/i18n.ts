import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const de = {
  app: { title: 'Choreo-Planer' },
  common: { undo: 'Rückgängig', redo: 'Wiederholen', language: 'Sprache' },
  choreo: { name: 'Name der Choreografie', default: 'Neue Choreografie' },
  play: { play: 'Abspielen', pause: 'Stopp', prev: 'Vorherige Formation', next: 'Nächste Formation' },
  formation: {
    title: 'Formationen',
    default: 'Formation {{n}}',
    add: 'Kopie hinzufügen',
    remove: 'Löschen',
    left: 'Nach links',
    right: 'Nach rechts',
    name: 'Name',
    duration: 'Übergang (s)',
    hold: 'Halten (s)',
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
    hint: 'Pfad-Punkt ziehen für Kurven, Doppelklick setzt zurück.',
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
  play: { play: 'Play', pause: 'Stop', prev: 'Previous formation', next: 'Next formation' },
  formation: {
    title: 'Formations',
    default: 'Formation {{n}}',
    add: 'Add copy',
    remove: 'Delete',
    left: 'Move left',
    right: 'Move right',
    name: 'Name',
    duration: 'Transition (s)',
    hold: 'Hold (s)',
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
    hint: 'Drag a path point to curve it, double-click to reset.',
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
