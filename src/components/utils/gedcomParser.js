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
    let currentRecord = null; // Referencia al registro INDI o FAM actual
    let currentRecordType = null; // 'INDI' o 'FAM'
    let contextStack = []; // Pila para manejar la estructura de niveles y etiquetas

    lines.forEach(line => {
        line = line.trim();
        if (!line) return; // Ignorar líneas vacías

        // Expresión regular para extraer nivel, etiqueta/ID y valor
        const match = line.match(/^(\d+)\s+(@\w+@|\w+)(?:\s+(.*))?$/);
        if (!match) return; // Ignorar líneas mal formadas

        const level = parseInt(match[1], 10);
        const tagOrId = match[2];
        const value = match[3] ? match[3].trim() : null;

        // --- Manejo de Niveles y Contexto ---
        // Si el nivel actual es menor o igual al último en la pila,
        // desapilamos hasta encontrar el nivel correcto.
        while (contextStack.length > 0 && level <= contextStack[contextStack.length - 1].level) {
            contextStack.pop();
        }

        // Obtener el contexto padre (si existe)
        const parentContext = contextStack.length > 0 ? contextStack[contextStack.length - 1] : null;

        // --- Procesamiento de Registros de Nivel 0 (INDI, FAM) ---
        if (level === 0) {
            contextStack = []; // Limpiar pila para nuevo registro de nivel superior
            if (tagOrId.startsWith('@') && tagOrId.endsWith('@')) {
                const id = tagOrId;
                currentRecordType = value; // El tipo (INDI, FAM) es el valor en nivel 0

                if (currentRecordType === 'INDI') {
                    currentRecord = individuals[id] = {
                        id: id,
                        name: 'Desconocido',
                        sex: 'U', // Unknown
                        birth: null,
                        death: null,
                        famc: null, // Familia como hijo
                        fams: [],   // Familias como cónyuge
                        _familiesAsChild: [], // Referencias a objetos FAM
                        _familiesAsSpouse: [], // Referencias a objetos FAM
                        _parents: [], // Referencias a objetos INDI (padres)
                        _children: [], // Referencias a objetos INDI (hijos)
                        _spouses: [], // Referencias a objetos INDI (cónyuges)
                    };
                    contextStack.push({ level: level, tag: currentRecordType, record: currentRecord });
                } else if (currentRecordType === 'FAM') {
                    currentRecord = families[id] = {
                        id: id,
                        husb: null, // ID del esposo
                        wife: null, // ID de la esposa
                        chil: [],   // IDs de los hijos
                        marr: null, // Evento de matrimonio
                        _husband: null, // Referencia al objeto INDI
                        _wife: null,    // Referencia al objeto INDI
                        _children: [],  // Referencias a objetos INDI
                    };
                    contextStack.push({ level: level, tag: currentRecordType, record: currentRecord });
                } else {
                    currentRecord = null; // Ignorar otros tipos de registro de nivel 0
                    currentRecordType = null;
                }
            } else {
                currentRecord = null; // Línea de nivel 0 inválida
                currentRecordType = null;
            }
        }
        // --- Procesamiento de Sub-etiquetas (Nivel > 0) ---
        else if (currentRecord && parentContext) {
            const currentTag = tagOrId;
            const currentContext = { level: level, tag: currentTag, record: parentContext.record }; // Hereda el registro del padre
            contextStack.push(currentContext);

            // Procesar etiquetas dentro de un registro INDI
            if (parentContext.tag === 'INDI') {
                const indi = parentContext.record;
                switch (currentTag) {
                    case 'NAME':
                        indi.name = value ? value.replace(/\//g, '') : 'Desconocido';
                        break;
                    case 'SEX':
                        indi.sex = value || 'U';
                        break;
                    case 'BIRT':
                        // Podríamos parsear sub-etiquetas DATE y PLAC aquí si existieran
                        indi.birth = { date: null, place: null }; // Placeholder
                        break;
                    case 'DEAT':
                        indi.death = { date: null, place: null, value: true }; // Placeholder, value=true indica que falleció
                        break;
                    case 'FAMC': // Familia donde es hijo
                        indi.famc = value;
                        break;
                    case 'FAMS': // Familia donde es cónyuge
                        indi.fams.push(value);
                        break;
                    // Sub-etiquetas de eventos (DATE, PLAC)
                    case 'DATE':
                        if (parentContext.level === level - 1) { // Asegura que DATE es hijo directo de BIRT/DEAT/MARR etc.
                            const eventTag = parentContext.tag.toLowerCase();
                            if (indi[eventTag]) {
                                indi[eventTag].date = value;
                            }
                        }
                        break;
                    case 'PLAC':
                         if (parentContext.level === level - 1) {
                            const eventTag = parentContext.tag.toLowerCase();
                            if (indi[eventTag]) {
                                indi[eventTag].place = value;
                            }
                        }
                        break;
                }
            }
            // Procesar etiquetas dentro de un registro FAM
            else if (parentContext.tag === 'FAM') {
                const fam = parentContext.record;
                switch (currentTag) {
                    case 'HUSB':
                        fam.husb = value;
                        break;
                    case 'WIFE':
                        fam.wife = value;
                        break;
                    case 'CHIL':
                        fam.chil.push(value);
                        break;
                    case 'MARR':
                        fam.marr = { date: null, place: null }; // Placeholder
                        break;
                    // Sub-etiquetas de eventos (DATE, PLAC) para MARR
                    case 'DATE':
                        if (parentContext.level === level - 1 && parentContext.tag === 'MARR') {
                             if (fam.marr) fam.marr.date = value;
                        }
                        break;
                    case 'PLAC':
                        if (parentContext.level === level - 1 && parentContext.tag === 'MARR') {
                             if (fam.marr) fam.marr.place = value;
                        }
                        break;
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
                    // Evitar duplicados si está en múltiples familias con la misma persona
                    if (!indi._spouses.some(sp => sp.id === spouseId)) {
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
     });

    return { individuals, families };
}

// Función auxiliar para encontrar un individuo inicial (p.ej., el primero)
export function findInitialIndividual(individuals) {
    const keys = Object.keys(individuals);
    return keys.length > 0 ? individuals[keys[0]] : null;
}
