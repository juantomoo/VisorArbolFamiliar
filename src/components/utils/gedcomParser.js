/**
 * Parser básico de GEDCOM (simplificado).
 * Extrae información esencial de individuos (INDI) y familias (FAM).
 * NOTA: Este parser es muy básico y puede no manejar todas las complejidades
 *       o variaciones del formato GEDCOM estándar. Se centra en las etiquetas
 *       más comunes para construir un árbol genealógico simple.
 */
export function parseGedcom(gedcomString) {
    const lines = gedcomString.split(/\r?\n/);
    const individuals = {}; // Almacena individuos por ID (@I...@)
    const families = {};    // Almacena familias por ID (@F...@)
    const multimedia = {}; // Mapa de objetos multimedia (OBJE)
    let currentRecord = null; // Referencia al registro INDI o FAM actual
    let currentRecordType = null; // 'INDI' o 'FAM'
    let contextStack = []; // Pila para manejar la estructura de niveles y etiquetas
    // --- NUEVO: Para eventos de familia ---
    let currentFamEvent = null;
    let currentObje = null;

    // --- PRIMER PASO: Recopilar objetos multimedia (OBJE) y sus rutas ---
    lines.forEach(line => {
        const match = line.match(/^(\d+)\s+(@\w+@|\w+)(?:\s+(.*))?$/);
        if (!match) return;
        const level = parseInt(match[1], 10);
        const tagOrId = match[2];
        const value = match[3] ? match[3].trim() : null;
        if (level === 0 && value === 'OBJE') {
            currentObje = { id: tagOrId, file: null, url: null };
            multimedia[tagOrId] = currentObje;
        } else if (currentObje && tagOrId === 'FILE') {
            currentObje.file = value;
        } else if (currentObje && tagOrId === 'TITL') {
            // Si es una URL, guárdala como url
            if (value && value.startsWith('http')) {
                currentObje.url = value;
            }
        } else if (currentObje && tagOrId === 'CONC') {
            // Concatenación de líneas largas para TITL
            if (currentObje.url !== null && value) {
                currentObje.url += value;
            }
        } else if (level === 0) {
            currentObje = null;
        }
    });

    // --- SEGUNDO PASO: Parseo normal de individuos y familias ---
    let currentIndi = null;
    let currentFam = null;
    let currentEvent = null;
    let currentEventType = null;
    lines.forEach((line, idx) => {
        line = line.trim();
        if (!line) return;
        const match = line.match(/^([0-9]+)\s+(@\w+@|\w+)(?:\s+(.*))?$/);
        if (!match) return;
        const level = parseInt(match[1], 10);
        const tagOrId = match[2];
        const value = match[3] ? match[3].trim() : null;

        // --- INICIO DE REGISTRO ---
        if (level === 0) {
            currentIndi = null;
            currentFam = null;
            currentEvent = null;
            currentEventType = null;
            if (tagOrId.startsWith('@') && tagOrId.endsWith('@')) {
                if (value === 'INDI') {
                    currentIndi = individuals[tagOrId] = {
                        id: tagOrId,
                        raw: [],
                        events: [],
                        famc: null,
                        fams: [],
                        _familiesAsChild: [],
                        _familiesAsSpouse: [],
                        _parents: [],
                        _children: [],
                        _spouses: [],
                        _exSpouses: [],
                        _stepChildren: [],
                        _stepRelations: {},
                    };
                } else if (value === 'FAM') {
                    currentFam = families[tagOrId] = {
                        id: tagOrId,
                        events: [],
                        chil: [],
                        _children: [],
                        _stepChildren: [],
                        _stepRelations: {},
                    };
                }
            }
        }
        // --- INDIVIDUO ---
        if (currentIndi) {
            currentIndi.raw.push(line);
            if (level === 1) {
                currentEvent = null;
                currentEventType = null;
                switch (tagOrId) {
                    case 'NAME':
                        currentIndi.name = value ? value.replace(/\//g, '') : 'Desconocido';
                        break;
                    case 'SEX':
                        currentIndi.sex = value || 'U';
                        break;
                    case 'BIRT':
                    case 'DEAT':
                    case 'EVEN':
                    case 'RESI':
                    case 'FACT':
                    case 'CHAN':
                    case 'BAPM':
                    case 'BURI':
                        currentEvent = { type: tagOrId, attrs: {}, lines: [line] };
                        currentEventType = tagOrId;
                        currentIndi.events.push(currentEvent);
                        if (tagOrId === 'BIRT') {
                            currentIndi.birth = currentEvent.attrs;
                        } else if (tagOrId === 'DEAT') {
                            currentIndi.death = currentEvent.attrs;
                        }
                        break;
                    case 'FAMC':
                        currentIndi.famc = value;
                        break;
                    case 'FAMS':
                        currentIndi.fams.push(value);
                        break;
                    case 'OBJE':
                        if (!currentIndi.objs) currentIndi.objs = [];
                        currentIndi.objs.push(value);
                        break;
                    default:
                        // Otros campos de nivel 1
                        break;
                }
            } else if (level === 2 && currentEvent) {
                currentEvent.lines.push(line);
                currentEvent.attrs[tagOrId.toLowerCase()] = value;
                // Si es BIRT o DEAT, también copia a birth/death directo
                if (currentEventType === 'BIRT' && currentIndi.birth) {
                    currentIndi.birth[tagOrId.toLowerCase()] = value;
                } else if (currentEventType === 'DEAT' && currentIndi.death) {
                    currentIndi.death[tagOrId.toLowerCase()] = value;
                }
            } else if (level > 2 && currentEvent) {
                currentEvent.lines.push(line);
                // Guarda atributos anidados como sub-objeto
                if (!currentEvent.attrs[tagOrId.toLowerCase()]) {
                    currentEvent.attrs[tagOrId.toLowerCase()] = value;
                }
            }
        }
        // --- FAMILIA ---
        if (currentFam) {
            if (level === 1) {
                switch (tagOrId) {
                    case 'HUSB':
                        currentFam.husb = value;
                        break;
                    case 'WIFE':
                        currentFam.wife = value;
                        break;
                    case 'CHIL':
                        currentFam.chil.push(value);
                        break;
                    case 'MARR':
                    case 'DIV':
                    case 'SEPARATION':
                    case 'DIVORCE':
                    case 'ENGA':
                        currentEvent = { type: tagOrId, attrs: {}, lines: [line] };
                        currentFam.events.push(currentEvent);
                        if (tagOrId === 'MARR') currentFam.marr = currentEvent.attrs;
                        break;
                    default:
                        break;
                }
            } else if (level === 2 && currentEvent) {
                currentEvent.lines.push(line);
                currentEvent.attrs[tagOrId.toLowerCase()] = value;
                if (currentEvent.type === 'MARR' && currentFam.marr) {
                    currentFam.marr[tagOrId.toLowerCase()] = value;
                }
            } else if (level > 2 && currentEvent) {
                currentEvent.lines.push(line);
                if (!currentEvent.attrs[tagOrId.toLowerCase()]) {
                    currentEvent.attrs[tagOrId.toLowerCase()] = value;
                }
            }
        }
    });

    // --- Post-procesamiento: Enlazar referencias ---
    // Conectar individuos con sus familias y viceversa
    Object.values(individuals).forEach(indi => {
        // Encontrar la familia donde es hijo y sus padres
        if (indi.famc && families[indi.famc]) {
            const familyAsChild = families[indi.famc];
            indi._familiesAsChild.push(familyAsChild);
            if (familyAsChild.husb && individuals[familyAsChild.husb]) {
                indi._parents.push(individuals[familyAsChild.husb]);
            }
            if (familyAsChild.wife && individuals[familyAsChild.wife]) {
                indi._parents.push(individuals[familyAsChild.wife]);
            }
        }
        // Encontrar las familias donde es cónyuge y los cónyuges e hijos
        indi.fams.forEach(famsId => {
            if (families[famsId]) {
                const familyAsSpouse = families[famsId];
                indi._familiesAsSpouse.push(familyAsSpouse);
                // Añadir cónyuge(s)
                const spouseId = (familyAsSpouse.husb === indi.id) ? familyAsSpouse.wife : familyAsSpouse.husb;
                if (spouseId && individuals[spouseId]) {
                    // Determinar si la relación está activa o terminada
                    const isEnded = familyAsSpouse.events.some(ev =>
                        ["DIV", "SEPARATION", "DIVORCE", "SEP"].includes(ev.type?.toUpperCase())
                    );
                    if (isEnded) {
                        if (!indi._exSpouses.some(sp => sp.id === spouseId)) {
                            indi._exSpouses.push(individuals[spouseId]);
                        }
                    } else {
                        if (!indi._spouses.some(sp => sp.id === spouseId)) {
                            indi._spouses.push(individuals[spouseId]);
                        }
                    }
                }
                // Añadir hijos de esta unión
                familyAsSpouse.chil.forEach(childId => {
                    if (individuals[childId]) {
                         // Evitar duplicados si es hijo en la misma familia
                        if (!indi._children.some(ch => ch.id === childId)) {
                            indi._children.push(individuals[childId]);
                        }
                    }
                });
                // Hijastros
                if (familyAsSpouse._stepRelations) {
                    Object.entries(familyAsSpouse._stepRelations).forEach(([rel, val]) => {
                        if (val && individuals[val]) {
                            if (!indi._stepChildren.some(ch => ch.id === val)) {
                                indi._stepChildren.push(individuals[val]);
                            }
                        }
                    });
                }
            }
        });
    });

    // Enlazar familias con los objetos individuo
     Object.values(families).forEach(fam => {
         if (fam.husb && individuals[fam.husb]) {
             fam._husband = individuals[fam.husb];
         }
         if (fam.wife && individuals[fam.wife]) {
             fam._wife = individuals[fam.wife];
         }
         fam.chil.forEach(childId => {
             if (individuals[childId]) {
                 fam._children.push(individuals[childId]);
             }
         });
         // Determinar estado de la relación
         fam.status = fam.events.some(ev => ["DIV", "SEPARATION", "DIVORCE", "SEP"].includes(ev.type?.toUpperCase())) ? 'ended' : 'active';
     });

    // Función segura para stringify que ignora referencias circulares
    function safeStringify(obj, space = 2) {
      const seen = new WeakSet();
      return JSON.stringify(obj, function(key, value) {
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) return undefined;
          seen.add(value);
        }
        return value;
      }, space);
    }

    // DEBUG: Mostrar todos los individuos parseados con fechas
    console.log('DEBUG individuos parseados:', safeStringify(individuals));
    // DEBUG: Mostrar todas las familias parseadas
    console.log('DEBUG familias parseadas:', safeStringify(families));
    return { individuals, families };
}

// Función auxiliar para encontrar un individuo inicial (p.ej., el primero)
export function findInitialIndividual(individuals) {
    const keys = Object.keys(individuals);
    return keys.length > 0 ? individuals[keys[0]] : null;
}
