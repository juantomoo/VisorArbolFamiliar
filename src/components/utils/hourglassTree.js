/**
 * Generador de datos para la visualización de árbol genealógico en forma de reloj de arena.
 * Toma los datos parseados (individuos, familias) y un ID de individuo central.
 * Genera listas de nodos para ancestros y descendientes con niveles generacionales.
 *
 * Limitaciones:
 * - Profundidad limitada para ancestros y descendientes para evitar explosión combinatoria.
 * - Representación simplificada de relaciones complejas (ej. múltiples cónyuges, hermanastros).
 */

const MAX_GENERATIONS_UP = 4; // Máximo nivel de ancestros a mostrar
const MAX_GENERATIONS_DOWN = 4; // Máximo nivel de descendientes a mostrar

/**
 * Construye la estructura de datos del árbol reloj de arena.
 * @param {string} centralId - ID del individuo en el centro.
 * @param {object} individuals - Objeto con todos los individuos parseados.
 * @param {object} families - Objeto con todas las familias parseadas.
 * @returns {object} - Estructura con { centralNode, ancestors: [[]...], descendants: [[]...] }
 *                     donde cada array interno representa una generación.
 */
export function buildHourglassTree(centralId, individuals, families) {
    const centralNode = individuals[centralId];
    if (!centralNode) {
        console.error("Individuo central no encontrado:", centralId);
        return { centralNode: null, ancestors: [], descendants: [] };
    }

    // Añadir referencia a sí mismo para consistencia
    centralNode.generation = 0;

    const ancestors = []; // Array de arrays (generaciones)
    const descendants = []; // Array de arrays (generaciones)
    const visitedAncestors = new Set(); // Para evitar ciclos y duplicados
    const visitedDescendants = new Set(); // Para evitar ciclos y duplicados

    // --- Recopilar Ancestros ---
    let currentAncestorGen = [centralNode]; // Empieza con el nodo central
    visitedAncestors.add(centralId);

    // --- Normaliza fechas de nacimiento y fallecimiento para el centralNode y todos los individuos ---
    Object.values(individuals).forEach(ind => {
        if (!ind.birth) ind.birth = { date: '', place: '' };
        if (!ind.death) ind.death = { date: '', place: '' };
        if (typeof ind.birth.date !== 'string') ind.birth.date = ind.birth.date || '';
        if (typeof ind.death.date !== 'string') ind.death.date = ind.death.date || '';
        if (typeof ind.birth.place !== 'string') ind.birth.place = ind.birth.place || '';
        if (typeof ind.death.place !== 'string') ind.death.place = ind.death.place || '';
    });

    for (let gen = 1; gen <= MAX_GENERATIONS_UP; gen++) {
        const nextAncestorGenSet = new Set(); // Usar Set para evitar duplicados en la misma generación
        const nextAncestorGenNodes = [];

        currentAncestorGen.forEach(person => {
            // Obtener padres directos a través de la familia donde es hijo (famc)
            person._parents?.forEach(parent => {
                if (parent && !visitedAncestors.has(parent.id)) {
                    if (!nextAncestorGenSet.has(parent.id)) {
                        parent.generation = -gen; // Generación negativa para ancestros
                        nextAncestorGenSet.add(parent.id);
                        nextAncestorGenNodes.push(parent);
                        visitedAncestors.add(parent.id); // Marcar como visitado globalmente
                    }
                }
            });
        });

        if (nextAncestorGenNodes.length === 0) break; // No hay más ancestros
        ancestors.unshift(nextAncestorGenNodes); // Añadir al principio (generaciones más antiguas primero en el array externo)
        currentAncestorGen = nextAncestorGenNodes; // Siguiente nivel para iterar
    }


    // --- Recopilar Descendientes ---
    let currentDescendantGen = [centralNode]; // Empieza con el nodo central
    visitedDescendants.add(centralId);

    for (let gen = 1; gen <= MAX_GENERATIONS_DOWN; gen++) {
        const nextDescendantGenSet = new Set();
        const nextDescendantGenNodes = [];

        currentDescendantGen.forEach(person => {
            // Obtener hijos directos a través de las familias donde es cónyuge (fams)
            person._children?.forEach(child => {
                 if (child && !visitedDescendants.has(child.id)) {
                     if (!nextDescendantGenSet.has(child.id)) {
                        child.generation = gen; // Generación positiva para descendientes
                        nextDescendantGenSet.add(child.id);
                        nextDescendantGenNodes.push(child);
                        visitedDescendants.add(child.id);
                     }
                 }
            });
        });

        if (nextDescendantGenNodes.length === 0) break; // No hay más descendientes
        descendants.push(nextDescendantGenNodes); // Añadir al final
        currentDescendantGen = nextDescendantGenNodes; // Siguiente nivel para iterar
    }

    // --- Recopilar Información Adicional (Hermanos, Cónyuges) para el nodo central ---
    // Hermanos: Hijos de los mismos padres (requiere buscar en la familia `famc` del nodo central)
    centralNode._siblings = [];
    if (centralNode.famc && families[centralNode.famc]) {
        const parentFamily = families[centralNode.famc];
        parentFamily._children?.forEach(sibling => {
            if (sibling.id !== centralNode.id) {
                sibling.generation = 0; // Misma generación que el central
                centralNode._siblings.push(sibling);
            }
        });
    }

    // Cónyuges: Ya están en `centralNode._spouses` gracias al post-procesamiento del parser
    // Ordenar cónyuges: primero los actuales, luego separados/divorciados
    if (Array.isArray(centralNode._spouses)) {
        centralNode._spouses = centralNode._spouses.slice().sort((a, b) => {
            const aDiv = hasDivorceOrSeparation(a, centralNode);
            const bDiv = hasDivorceOrSeparation(b, centralNode);
            return (aDiv === bDiv) ? 0 : aDiv ? 1 : -1;
        });
        centralNode._spouses.forEach(spouse => {
            spouse.generation = 0; // Misma generación
        });
    }

    // Limpieza: Eliminar referencias circulares innecesarias para evitar problemas de serialización si fuera necesario
    // (Aunque Vue 3 maneja bien las referencias internas en reactividad)
    // Opcional: Podrías crear copias superficiales de los nodos aquí si prefieres datos puros.

    return {
        centralNode,
        ancestors, // Array de generaciones [[gen -N], [gen -N+1], ..., [gen -1]]
        descendants // Array de generaciones [[gen 1], [gen 2], ..., [gen M]]
    };
}

// Utilidad: Detecta si hay divorcio/separación entre dos personas
function hasDivorceOrSeparation(spouse, central) {
    // Busca eventos de divorcio/separación en los datos raw de ambos
    const events = [spouse, central].flatMap(p => (p.raw?.events || []));
    return events.some(ev =>
        ["DIV", "SEPARATION", "DIVORCE", "SEP"].includes(ev.type?.toUpperCase())
    );
}

/**
 * Calcula el número total de nodos en una generación, incluyendo cónyuges si aplica.
 * (Simplificado: aquí solo contamos los nodos principales por ahora)
 */
function countNodesInGeneration(generationNodes) {
    return generationNodes.length;
}

/**
 * Calcula el desplazamiento horizontal para un nodo dentro de su generación.
 * @param {number} nodeIndex - Índice del nodo en el array de su generación.
 * @param {number} totalNodesInGen - Total de nodos en esa generación.
 * @param {number} generationWidth - Ancho disponible para la generación.
 * @returns {number} - Posición 'left' relativa al centro de la generación.
 */
export function calculateNodeHorizontalOffset(nodeIndex, totalNodesInGen, generationWidth) {
    if (totalNodesInGen <= 0) return 0;
    // Distribuye los nodos equitativamente
    const spacing = generationWidth / (totalNodesInGen + 1);
    // Calcula la posición centrada: (índice + 1) * espaciado - (ancho total / 2)
    // Ajustamos para que el centro (índice N/2) quede cerca de 0
    const position = (nodeIndex + 1) * spacing - (generationWidth / 2);
    // Ajuste fino para centrar mejor el grupo
    const groupCenterOffset = spacing / 2;
    return position - groupCenterOffset;

}

/**
 * Calcula el desplazamiento vertical para una generación.
 * @param {number} generationLevel - Nivel de la generación (0 para central, <0 ancestros, >0 descendientes).
 * @param {number} verticalSpacing - Espacio vertical entre generaciones.
 * @returns {number} - Posición 'top' relativa al centro vertical.
 */
export function calculateGenerationVerticalOffset(generationLevel, verticalSpacing) {
    return generationLevel * verticalSpacing;
}