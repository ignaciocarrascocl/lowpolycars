import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export default class RoadManager {
  constructor(scene) {
    this.scene = scene;
    this.roadSegments = [];
    this.roadModel = null;
    this.visibleSegments = 30; // Número de segmentos visibles a la vez
    this.roadWidth = 1; // Ancho base total de la carretera (4 carriles)
    this.laneWidth = this.roadWidth / 4; // Ancho base de cada carril
    this.playerZPosition = 0; // La posición Z actual del jugador (reemplaza roadPosition)
    
    // Factor de escala para los modelos de carretera
    this.scaleFactor = {
      x: 20,
      y: 20, 
      z: 20
    };
    
    // La longitud real de un segmento de carretera (se calculará después de cargar el modelo)
    this.actualSegmentLength = 0;
    
    // Porcentaje central de la carretera para los carriles (80%)
    this.laneAreaPercentage = 0.8;
    
    this.init();
  }

  async init() {
    // Cargar el modelo de la carretera
    await this.loadRoadModel();
    // Inicializar los segmentos iniciales
    this.createInitialRoad();
  }

  async loadRoadModel() {
    return new Promise((resolve) => {
      const loader = new GLTFLoader();
      loader.load('/models/roads/road-straight.glb', (gltf) => {
        this.roadModel = gltf.scene;
        
        // Configurar el modelo para que reciba sombras
        this.roadModel.traverse((child) => {
          if (child.isMesh) {
            child.receiveShadow = true;
          }
        });
        
        // Rotar 90 grados alrededor del eje Y
        this.roadModel.rotation.y = Math.PI / 2;
        
        // Aplicar la escala configurada
        this.roadModel.scale.set(
          this.scaleFactor.x,
          this.scaleFactor.y,
          this.scaleFactor.z
        );
        
        // Calcular la longitud real del segmento después de aplicar la escala
        // Usamos una caja auxiliar para obtener las dimensiones exactas
        const boundingBox = new THREE.Box3().setFromObject(this.roadModel);
        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        
        // La longitud del segmento es la dimensión X (después de rotar 90 grados)
        this.actualSegmentLength = size.x;
        console.log("Longitud real del segmento:", this.actualSegmentLength);
        
        resolve();
      });
    });
  }

  createInitialRoad() {
    // Crear segmentos iniciales de la carretera
    if (this.actualSegmentLength === 0) {
      console.error("Longitud del segmento no calculada correctamente");
      return;
    }
    
    // Distribuir los segmentos equitativamente delante y detrás del jugador
    // Usamos Math.floor para asegurarnos de tener más segmentos por delante que por detrás
    const segmentsForward = Math.floor(this.visibleSegments * 0.7); // 70% hacia adelante (delante del jugador)
    const segmentsBackward = this.visibleSegments - segmentsForward; // 30% hacia atrás (detrás del jugador)
    
    console.log(`Creando carretera inicial: ${segmentsForward} segmentos hacia adelante, ${segmentsBackward} segmentos hacia atrás`);
    
    // Crear segmentos hacia adelante (valores negativos de Z, el jugador avanza en Z negativo)
    for (let i = 0; i < segmentsForward; i++) {
      this.addRoadSegment(-i * this.actualSegmentLength);
    }
    
    // Crear segmentos hacia atrás (valores positivos de Z, detrás del jugador)
    for (let i = 1; i <= segmentsBackward; i++) {
      this.addRoadSegment(i * this.actualSegmentLength);
    }
  }

  addRoadSegment(zPosition) {
    if (!this.roadModel) return;
    
    // Clonar el modelo para cada segmento
    const segment = this.roadModel.clone();
    
    // Colocarlo en la posición Z apropiada
    segment.position.z = zPosition;
    
    // Añadir el segmento a la escena y al array de segmentos
    this.scene.add(segment);
    this.roadSegments.push({
      model: segment,
      position: zPosition
    });
    
    return segment;
  }

  update() {
    // Ya no necesitamos avanzar la carretera
    // Las actualizaciones ahora se basan en la posición del jugador
    this.updateRoadSegments();
  }

  updateRoadSegments() {
    if (this.actualSegmentLength === 0) return;
    
    // Calcular el índice del segmento actual basado en la posición del jugador
    const currentSegmentIndex = Math.floor(this.playerZPosition / this.actualSegmentLength);
    
    // Distribuir los segmentos visibles con más segmentos por delante (70% adelante, 30% atrás)
    const segmentsForward = Math.floor(this.visibleSegments * 0.7);
    const segmentsBackward = this.visibleSegments - segmentsForward;
    
    // Calcular las posiciones Z objetivo más alejadas para los segmentos delante y detrás
    const targetForwardZ = this.playerZPosition - (segmentsForward * this.actualSegmentLength);
    const targetBackwardZ = this.playerZPosition + (segmentsBackward * this.actualSegmentLength);
    
    // Eliminar segmentos que están demasiado atrás (detrás del jugador)
    while (this.roadSegments.length > 0 && 
           this.roadSegments[0].position > targetBackwardZ) {
      const oldSegment = this.roadSegments.shift();
      this.scene.remove(oldSegment.model);
    }
    
    // Eliminar segmentos que están demasiado adelante (muy por delante del jugador)
    while (this.roadSegments.length > 0 && 
           this.roadSegments[this.roadSegments.length-1].position < targetForwardZ) {
      const oldSegment = this.roadSegments.pop();
      this.scene.remove(oldSegment.model);
    }
    
    // Ordenar los segmentos por posición Z (de mayor a menor)
    this.roadSegments.sort((a, b) => b.position - a.position);
    
    // Añadir nuevos segmentos por delante (Z negativo, dirección de avance)
    if (this.roadSegments.length > 0) {
      let frontmostZ = this.roadSegments[this.roadSegments.length - 1].position;
      while (frontmostZ > targetForwardZ) {
        frontmostZ -= this.actualSegmentLength;
        this.addRoadSegment(frontmostZ);
      }
    } else {
      // Si no hay segmentos, crear desde la posición del jugador
      let frontmostZ = this.playerZPosition;
      for (let i = 0; i < segmentsForward; i++) {
        frontmostZ -= this.actualSegmentLength;
        this.addRoadSegment(frontmostZ);
      }
    }
    
    // Añadir nuevos segmentos por detrás (Z positivo, detrás del jugador)
    if (this.roadSegments.length > 0) {
      let backmostZ = this.roadSegments[0].position;
      while (backmostZ < targetBackwardZ) {
        backmostZ += this.actualSegmentLength;
        this.addRoadSegment(backmostZ);
      }
    } else {
      // Si no hay segmentos, crear desde la posición del jugador
      let backmostZ = this.playerZPosition;
      for (let i = 0; i < segmentsBackward; i++) {
        backmostZ += this.actualSegmentLength;
        this.addRoadSegment(backmostZ);
      }
    }
  }

  // Actualiza la posición Z del jugador (usado por PlayerController)
  setPlayerZPosition(zPosition) {
    this.playerZPosition = zPosition;
  }

  getPlayerZPosition() {
    // Retorna la posición Z actual del jugador en el mundo
    return this.playerZPosition;
  }

  getLanePosition(laneIndex) {
    // Calcula el ancho real de la carretera considerando la escala
    const scaledRoadWidth = this.roadWidth * this.scaleFactor.x;
    
    // Usamos solo el 80% central para los carriles
    const usableRoadWidth = scaledRoadWidth * this.laneAreaPercentage;
    const scaledLaneWidth = usableRoadWidth / 4;
    
    // Calculamos el margen disponible a cada lado (10% del ancho total)
    const sideMargin = (scaledRoadWidth - usableRoadWidth) / 2;
    
    // Convierte un índice de carril (0-3) a una posición X en el mundo
    // Carril 0 es el de la izquierda, carril 3 es el de la derecha
    // Centramos los carriles en el eje X, considerando el margen
    const laneStartX = -scaledRoadWidth / 2 + sideMargin;
    return laneStartX + scaledLaneWidth * (laneIndex + 0.5);
  }

  // Método para actualizar la escala de los modelos de carretera
  updateScale(axis, value) {
    if (!this.roadModel) return;
    
    // Actualizar el factor de escala
    this.scaleFactor[axis] = value;
    
    // Actualizar el modelo de referencia
    this.roadModel.scale[axis] = value;
    
    // Recalcular la longitud real del segmento después de cambiar la escala
    if (axis === 'x' || axis === 'z') {
      const boundingBox = new THREE.Box3().setFromObject(this.roadModel);
      const size = new THREE.Vector3();
      boundingBox.getSize(size);
      this.actualSegmentLength = size.x; // La longitud es la dimensión X después de rotar
      console.log("Nueva longitud del segmento:", this.actualSegmentLength);
    }
    
    // Actualizar todos los segmentos existentes
    for (const segment of this.roadSegments) {
      segment.model.scale[axis] = value;
    }
    
    // Siempre reiniciar la carretera cuando se cambia la escala para evitar huecos
    this.reset();
  }

  reset() {
    // Eliminar todos los segmentos existentes
    for (const segment of this.roadSegments) {
      this.scene.remove(segment.model);
    }
    this.roadSegments = [];
    
    // Reiniciar posición
    this.playerZPosition = 0;
    
    // Recrear la carretera inicial
    this.createInitialRoad();
  }
}