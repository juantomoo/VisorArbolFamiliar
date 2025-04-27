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
    // --- NUEVO: Para hijastros/padrastros ---
    let lastFamcId = null;
    let lastChildId = null;
    let lastChildFrel = null;
    let lastChildMrel = null;
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
            lastFamcId = null;
            lastChildId = null;
            lastChildFrel = null;
            lastChildMrel = null;
            if (tagOrId.startsWith('@') && tagOrId.endsWith('@')) {
                if (value === 'INDI') {
                    currentIndi = individuals[tagOrId] = {
                        id: tagOrId,
                        raw: [],
                        events: [],
                        famc: null,
                        fams: [],
                        famcRelations: {}, // NUEVO: para mapear FAMC a { _FREL, _MREL }
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
                        lastFamcId = value;
                        break;
                    case 'FAMS':
                        currentIndi.fams.push(value);
                        break;
                    case 'OBJE':
                        if (!currentIndi.objs) currentIndi.objs = [];
                        currentIndi.objs.push(value);
                        break;
                    default:
                        break;
                }
            } else if (level === 2 && lastFamcId) {
                // Guarda _FREL y _MREL asociados a la última FAMC
                if (tagOrId === '_FREL' || tagOrId === '_MREL') {
                    if (!currentIndi.famcRelations[lastFamcId]) currentIndi.famcRelations[lastFamcId] = {};
                    currentIndi.famcRelations[lastFamcId][tagOrId] = value;
                }
            } else if (level === 2 && currentEvent) {
                currentEvent.lines.push(line);
                currentEvent.attrs[tagOrId.toLowerCase()] = value;
                if (currentEventType === 'BIRT' && currentIndi.birth) {
                    currentIndi.birth[tagOrId.toLowerCase()] = value;
                } else if (currentEventType === 'DEAT' && currentIndi.death) {
                    currentIndi.death[tagOrId.toLowerCase()] = value;
                }
            } else if (level > 2 && currentEvent) {
                currentEvent.lines.push(line);
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
                        lastChildId = value;
                        lastChildFrel = null;
                        lastChildMrel = null;
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
            } else if (level === 2 && lastChildId) {
                if (tagOrId === '_FREL') {
                    lastChildFrel = value;
                } else if (tagOrId === '_MREL') {
                    lastChildMrel = value;
                }
                if ((lastChildFrel && lastChildFrel.toLowerCase() === 'step') || (lastChildMrel && lastChildMrel.toLowerCase() === 'step')) {
                    if (!currentFam._stepRelations) currentFam._stepRelations = {};
                    let parentId = null;
                    if (lastChildFrel && lastChildFrel.toLowerCase() === 'step' && currentFam.husb) parentId = currentFam.husb;
                    if (lastChildMrel && lastChildMrel.toLowerCase() === 'step' && currentFam.wife) parentId = currentFam.wife;
                    if (parentId) {
                        currentFam._stepRelations[parentId + '-' + lastChildId] = { parentId, childId: lastChildId };
                    }
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
                    // Revisar eventos tipo DIV, SEPARATION, o EVEN con TYPE Separation/Divorce
                    let isEnded = false;
                    for (const ev of familyAsSpouse.events) {
                        const evType = (ev.type || '').toUpperCase();
                        if (["DIV", "SEPARATION", "DIVORCE", "SEP"].includes(evType)) {
                            isEnded = true;
                            break;
                        }
                        // GEDCOM: Separación como EVEN + TYPE Separation
                        if (evType === 'EVEN') {
                            // TYPE puede estar como atributo o como subevento
                            if (ev.attrs && ev.attrs.type && (ev.attrs.type + '').toLowerCase().includes('separ')) {
                                isEnded = true;
                                break;
                            }
                            // Buscar TYPE en las líneas del evento
                            if (ev.lines) {
                                for (const l of ev.lines) {
                                    if (l.toLowerCase().includes('type separation')) {
                                        isEnded = true;
                                        break;
                                    }
                                }
                                if (isEnded) break;
                            }
                        }
                    }
                    // Eliminar de _spouses si ya estaba (por si el parser anterior lo puso)
                    indi._spouses = indi._spouses.filter(sp => sp.id !== spouseId);
                    indi._exSpouses = indi._exSpouses.filter(sp => sp.id !== spouseId);
                    if (isEnded) {
                        indi._exSpouses.push(individuals[spouseId]);
                    } else {
                        indi._spouses.push(individuals[spouseId]);
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

    // --- NUEVO: Detectar relaciones hijastro/padrastro robustamente ---
    Object.values(families).forEach(fam => {
        if (!fam.husb && !fam.wife) return;
        fam.chil.forEach(childId => {
            const child = individuals[childId];
            if (!child) return;
            const rels = child.famcRelations && child.famcRelations[fam.id];
            if (rels) {
                if (fam.husb && rels['_FREL'] && rels['_FREL'].toLowerCase() === 'step') {
                    // Hijo es hijastro del esposo
                    if (!fam._stepRelations) fam._stepRelations = {};
                    fam._stepRelations[fam.husb + '-' + childId] = { parentId: fam.husb, childId };
                }
                if (fam.wife && rels['_MREL'] && rels['_MREL'].toLowerCase() === 'step') {
                    // Hijo es hijastro de la esposa
                    if (!fam._stepRelations) fam._stepRelations = {};
                    fam._stepRelations[fam.wife + '-' + childId] = { parentId: fam.wife, childId };
                }
            }
        });
    });

    // --- NUEVO: Propagar relaciones de hijastros/padrastros a los individuos ---
    Object.values(families).forEach(fam => {
        if (fam._stepRelations) {
            Object.values(fam._stepRelations).forEach(rel => {
                const parent = individuals[rel.parentId];
                const child = individuals[rel.childId];
                if (parent && child) {
                    // Añadir hijastro al padrastro/madrastra
                    if (!parent._stepChildren.some(ch => ch.id === child.id)) {
                        parent._stepChildren.push(child);
                    }
                    // Añadir relación al campo _stepRelations del padrastro/madrastra
                    if (!parent._stepRelations) parent._stepRelations = {};
                    parent._stepRelations[rel.parentId + '-' + rel.childId] = rel;
                    // (Opcional) Añadir relación al campo _stepRelations del hijastro
                    if (!child._stepRelations) child._stepRelations = {};
                    child._stepRelations[rel.parentId + '-' + rel.childId] = rel;
                }
            });
        }
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
    return { individuals, families, multimedia };
}

// Función auxiliar para encontrar un individuo inicial (p.ej., el primero)
export function findInitialIndividual(individuals) {
    const keys = Object.keys(individuals);
    return keys.length > 0 ? individuals[keys[0]] : null;
}
