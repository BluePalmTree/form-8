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
  part: {
    whole: 'Ganzer Tanz',
    default: 'Teil {{n}}',
    name: 'Name des Teils',
    start: 'Teil hier beginnen',
    merge: 'Mit vorherigem Teil verbinden',
  },
  objects: {
    title: 'Objekte ({{count}})',
    add: '+ Rechteck',
    hint: 'Bühnenbild, Podeste oder andere Gegenstände als Rechtecke platzieren.',
    name: 'Beschriftung',
    color: 'Farbe',
    x: 'X (m von links)',
    y: 'Y (m von hinten)',
    w: 'Breite (m)',
    h: 'Tiefe (m)',
    rotation: 'Drehung (°)',
    perFormation: 'Position, Größe und Drehung gelten nur für die gewählte Formation. Beim Abspielen gleitet das Objekt zur nächsten.',
    remove: 'Objekt löschen',
  },
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
  account: {
    title: 'Cloud',
    hint: 'Melde dich an, um Choreografien auf mehreren Geräten zu nutzen. Du bekommst einen Login-Link per E-Mail.',
    email: 'E-Mail-Adresse',
    send: 'Login-Link senden',
    sent: 'Link gesendet – öffne ihn auf diesem Gerät.',
    failed: 'Der Link konnte nicht gesendet werden.',
    signedIn: 'Angemeldet als {{email}}',
    signOut: 'Abmelden',
    uploadLocal: '{{count}} lokale Choreografie(n) in die Cloud hochladen?',
    status: { idle: 'Synchronisiert', syncing: 'Synchronisiere …', pending: 'Änderungen ausstehend', error: 'Sync-Fehler – wird erneut versucht' },
    conflict: '„{{name}}“ wurde auf einem anderen Gerät geändert.',
    keepCloud: 'Cloud-Version behalten',
    keepLocal: 'Lokale Version behalten',
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
  part: {
    whole: 'Whole dance',
    default: 'Part {{n}}',
    name: 'Part name',
    start: 'Start part here',
    merge: 'Merge with previous part',
  },
  objects: {
    title: 'Objects ({{count}})',
    add: '+ Rectangle',
    hint: 'Place set pieces, platforms or other items as rectangles.',
    name: 'Label',
    color: 'Color',
    x: 'X (m from left)',
    y: 'Y (m from back)',
    w: 'Width (m)',
    h: 'Depth (m)',
    rotation: 'Rotation (°)',
    perFormation: 'Position, size and rotation apply to the selected formation only. During playback the object glides to the next one.',
    remove: 'Delete object',
  },
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
  account: {
    title: 'Cloud',
    hint: 'Sign in to use your choreographies on several devices. You will get a login link by email.',
    email: 'Email address',
    send: 'Send login link',
    sent: 'Link sent – open it on this device.',
    failed: 'The link could not be sent.',
    signedIn: 'Signed in as {{email}}',
    signOut: 'Sign out',
    uploadLocal: 'Upload {{count}} local choreography(ies) to the cloud?',
    status: { idle: 'Synced', syncing: 'Syncing …', pending: 'Changes pending', error: 'Sync error – will retry' },
    conflict: '“{{name}}” was changed on another device.',
    keepCloud: 'Keep cloud version',
    keepLocal: 'Keep local version',
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
