<template>
  <div class="full-screen">
    <h2>Visualizador de Árbol Genealógico (GEDCOM)</h2>
    <input type="file" accept=".ged,.gedcom" @change="onFileChange" />
    <div v-if="error" class="error">{{ error }}</div>
    <div class="controls">
      <button @click="layout = 'horizontal'">Horizontal</button>
      <button @click="layout = 'vertical'">Vertical</button>
      <button @click="layout = 'radial'">Radial</button>
    </div>
    <div ref="treeContainer" class="tree-container"></div>
    <div v-if="selectedNode" class="node-details">
      <h3>Detalles</h3>
      <p><b>Nombre:</b> {{ selectedNode.data.name }}</p>
      <p v-if="selectedNode.data.id"><b>ID:</b> {{ selectedNode.data.id }}</p>
      <button @click="selectedNode = null">Cerrar</button>
    </div>
  </div>
</template>

<script>
import * as parseGedcom from 'parse-gedcom';
import * as d3 from 'd3';

export default {
  name: 'GedcomTree',
  data() {
    return {
      gedcomData: null,
      error: null,
      layout: 'horizontal',
      selectedNode: null,
    };
  },
  watch: {
    layout() {
      this.$nextTick(this.renderTree);
    }
  },
  methods: {
    onFileChange(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const text = evt.target.result;
          this.gedcomData = parseGedcom.parse(text);
          this.error = null;
          this.selectedNode = null;
          this.$nextTick(this.renderTree);
        } catch (err) {
          this.error = 'Error al procesar el archivo GEDCOM.';
        }
      };
      reader.readAsText(file);
    },
    renderTree() {
      d3.select(this.$refs.treeContainer).selectAll('*').remove();
      if (!this.gedcomData || !Array.isArray(this.gedcomData.children)) {
        this.error = 'El archivo GEDCOM no tiene datos válidos (no se encontró children en la raíz).';
        console.error('gedcomData:', this.gedcomData);
        return;
      }
      const root = this.gedcomToTree(this.gedcomData.children);
      if (!root) {
        this.error = 'No se pudo construir el árbol.';
        return;
      }
      // Responsive SVG
      const container = this.$refs.treeContainer;
      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight - 100;
      let dx = 16, dy = 120; // Espaciado base
      let tree, diagonal;
      let rootD3 = d3.hierarchy(root);
      // Layouts
      if (this.layout === 'vertical') {
        tree = d3.tree().nodeSize([dy, dx]);
        diagonal = d3.linkHorizontal().x(d => d.x).y(d => d.y);
        tree(rootD3);
      } else if (this.layout === 'radial') {
        // Ajusta el radio según la cantidad de nodos
        const nodeCount = rootD3.descendants().length;
        const radius = Math.max(200, Math.min(width, height) / 2 - 60, nodeCount * 4);
        tree = d3.tree().size([2 * Math.PI, radius]);
        tree(rootD3);
        diagonal = d => d3.linkRadial().angle(d => d.x).radius(d => d.y)(d);
      } else { // horizontal
        tree = d3.tree().nodeSize([dx, dy]);
        diagonal = d3.linkHorizontal().x(d => d.y).y(d => d.x);
        tree(rootD3);
      }
      // Pan & zoom
      const zoom = d3.zoom().scaleExtent([0.1, 2]).on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
      const svg = d3.select(container)
        .append('svg')
        .attr('width', '100%')
        .attr('height', height)
        .call(zoom)
        .on('dblclick.zoom', null);
      // Centrado automático
      let g = svg.append('g');
      if (this.layout === 'radial') {
        g.attr('transform', `translate(${width / 2},${height / 2})`);
      } else if (this.layout === 'vertical') {
        g.attr('transform', `translate(${width / 2},40)`);
      } else {
        g.attr('transform', `translate(40,${height / 2})`);
      }
      // Links
      g.append('g')
        .attr('fill', 'none')
        .attr('stroke', '#555')
        .attr('stroke-opacity', 0.4)
        .attr('stroke-width', 1.2)
        .selectAll('path')
        .data(rootD3.links())
        .join('path')
        .attr('d', diagonal);
      // Nodes
      const node = g.append('g')
        .selectAll('g')
        .data(rootD3.descendants())
        .join('g')
        .attr('transform', d => {
          if (this.layout === 'vertical') return `translate(${d.x},${d.y})`;
          if (this.layout === 'radial') {
            const [angle, r] = [d.x, d.y];
            return `rotate(${angle * 180 / Math.PI - 90}) translate(${r},0)`;
          }
          return `translate(${d.y},${d.x})`;
        })
        .call(d3.drag()
          .on('start', function (event, d) {
            d3.select(this).raise().attr('stroke', 'black');
          })
          .on('drag', function (event, d) {
            d3.select(this).attr('transform', `translate(${event.x},${event.y})`);
          })
          .on('end', function (event, d) {
            d3.select(this).attr('stroke', null);
          })
        );
      // Tamaño de nodo y fuente adaptativo
      const nodeRadius = Math.max(3, 12 - Math.log2(rootD3.descendants().length));
      const fontSize = Math.max(7, 16 - Math.log2(rootD3.descendants().length));
      node.append('circle')
        .attr('fill', d => d.children ? '#555' : '#999')
        .attr('r', nodeRadius)
        .on('click', (event, d) => {
          this.selectedNode = d;
        });
      node.append('text')
        .attr('dy', '0.31em')
        .attr('x', d => {
          if (this.layout === 'radial') return d.x < Math.PI === !d.children ? 8 : -8;
          return d.children ? -12 : 12;
        })
        .attr('text-anchor', d => {
          if (this.layout === 'radial') return d.x < Math.PI === !d.children ? 'start' : 'end';
          return d.children ? 'end' : 'start';
        })
        .attr('transform', d => {
          if (this.layout === 'radial') {
            return d.x >= Math.PI ? 'rotate(180)' : null;
          }
          return null;
        })
        .text(d => d.data.name)
        .style('font-size', fontSize + 'px')
        .style('cursor', 'pointer')
        .on('click', (event, d) => {
          this.selectedNode = d;
        })
        .clone(true).lower()
        .attr('stroke', 'white');
    },
    gedcomToTree(gedcom) {
      if (!Array.isArray(gedcom)) return null;
      const individuals = {};
      gedcom.forEach(node => {
        if (node.type === 'INDI') {
          const id = node.data && node.data.xref_id;
          const nameNode = node.children.find(n => n.type === 'NAME');
          individuals[id] = {
            id,
            name: nameNode ? nameNode.value.replace(/\//g, '') : 'Sin nombre',
            children: [],
          };
        }
      });
      gedcom.forEach(node => {
        if (node.type === 'FAM') {
          const parents = [];
          let childrenArr = [];
          node.children.forEach(n => {
            if ((n.type === 'HUSB' || n.type === 'WIFE') && individuals[n.data && n.data.pointer]) {
              parents.push(individuals[n.data.pointer]);
            }
            if (n.type === 'CHIL' && individuals[n.data && n.data.pointer]) {
              childrenArr.push(individuals[n.data.pointer]);
            }
          });
          parents.forEach(parent => {
            parent.children.push(...childrenArr);
          });
        }
      });
      // Encuentra todos los individuos sin padres (raíces)
      const hasParent = new Set();
      Object.values(individuals).forEach(ind => {
        ind.children.forEach(child => hasParent.add(child.id));
      });
      const roots = Object.values(individuals).filter(ind => !hasParent.has(ind.id));
      // Si no hay raíces, muestra todos los individuos
      if (roots.length === 0) return Object.values(individuals);
      // Si hay una sola raíz, retorna solo esa, si hay varias, retorna el array
      return roots.length === 1 ? roots[0] : { name: 'Raíces', children: roots };
    },
  },
};
</script>

<style scoped>
.full-screen {
  position: fixed;
  inset: 0;
  background: #fafafa;
  z-index: 1;
  overflow: hidden;
}
.tree-container {
  width: 100vw;
  height: calc(100vh - 120px);
  overflow: auto;
  border: 1px solid #ccc;
  background: #fafafa;
}
.controls {
  margin: 1rem 0;
}
.node-details {
  position: absolute;
  top: 2rem;
  right: 2rem;
  background: #fff;
  border: 1px solid #aaa;
  border-radius: 8px;
  box-shadow: 0 2px 8px #0002;
  padding: 1rem;
  min-width: 250px;
  z-index: 10;
}
.error {
  color: red;
  margin-top: 1rem;
}
</style>
