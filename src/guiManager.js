import GUI from 'lil-gui';
import * as THREE from 'three';

export default class GuiManager {
  constructor(scene, car, directionalLight, ambientLight, roadManager, playerController) {
    this.scene = scene;
    this.car = car;
    this.directionalLight = directionalLight;
    this.ambientLight = ambientLight;
    this.roadManager = roadManager;
    this.playerController = playerController; // Añadido playerController
    this.camera = null; // Se asignará desde GameInit
    this.gui = new GUI();
    this.cameraControls = null; // Referencia para acceder desde otros archivos
    this.cameraPresets = {}; // Para almacenar configuraciones guardadas
    this.postProcessing = null; // Referencia al gestor de post-procesamiento
    this.init();
  }

  setCamera(camera) {
    this.camera = camera;
  }

  setPostProcessing(postProcessing) {
    this.postProcessing = postProcessing;
    // Configurar controles de post-procesamiento una vez que esté disponible
    this.setupPostProcessingFolder();
  }

  init() {
    this.setupCameraFolder();
    this.setupRoadFolder();
    this.setupEnvironmentFolder(); // Nueva sección para cielo y niebla
    this.setupPlayerFolder(); // Nueva sección para opciones del jugador
    this.setupInstructions();
  }

  setupCameraFolder() {
    // En lugar de mostrar todas las opciones de la cámara, vamos a establecer 
    // valores por defecto que funcionan bien y no permitir su modificación en la GUI
    
    // Propiedades de la cámara que se usarán internamente
    this.cameraControls = {
      height: 5,
      distance: 5,
      fov: 40,
      lookAheadDistance: 10,
      smoothTransition: true,
      transitionSpeed: 0.05,
      dynamicCameraEnabled: true,
      dynamicHeight: 5,
      dynamicDistance: 5,
      dynamicFOV: 40
    };
    
    // No añadimos ninguna carpeta o control para la cámara a la GUI
    // Los parámetros se gestionarán internamente en el código
  }

  setupRoadFolder() {
    const roadFolder = this.gui.addFolder('Bloques de Carretera');
    
    // Velocidad del jugador - Ahora son múltiples controles de velocidad
    if (this.playerController) {
      const speedFolder = roadFolder.addFolder('Velocidad del Vehículo');
      
      // Velocidad actual
      speedFolder.add(this.playerController, 'velocity', this.playerController.minSpeed, this.playerController.maxSpeed)
        .name('Velocidad actual')
        .onChange(value => {
          this.playerController.velocity = Number(value);
        })
        .listen(); // Para que se actualice cuando cambie por teclado
      
      // Velocidad predeterminada
      speedFolder.add(this.playerController, 'defaultSpeed', 200, 600)
        .name('Velocidad predeterminada')
        .onChange(value => {
          this.playerController.defaultSpeed = Number(value);
        });
      
      // Velocidad máxima
      speedFolder.add(this.playerController, 'maxSpeed', 400, 1200)
        .name('Velocidad máxima')
        .onChange(value => {
          this.playerController.maxSpeed = Number(value);
          // Ajustar el rango del slider de velocidad actual
          for (const controller of speedFolder.controllers) {
            if (controller._name === 'Velocidad actual') {
              controller.max(value);
            }
          }
        });
      
      // Velocidad mínima
      speedFolder.add(this.playerController, 'minSpeed', 100, 300)
        .name('Velocidad mínima')
        .onChange(value => {
          this.playerController.minSpeed = Number(value);
          // Ajustar el rango del slider de velocidad actual
          for (const controller of speedFolder.controllers) {
            if (controller._name === 'Velocidad actual') {
              controller.min(value);
            }
          }
        });
      
      // Incremento/decremento de velocidad por pulsación de tecla
      speedFolder.add(this.playerController, 'speedDelta', 10, 100)
        .name('Incremento velocidad')
        .onChange(value => {
          this.playerController.speedDelta = Number(value);
        });
      
      // Factor de velocidad (conversión de velocidad interna a unidades de mundo)
      speedFolder.add(this.playerController, 'speedFactor', 0.01, 0.2)
        .name('Factor velocidad')
        .onChange(value => {
          this.playerController.speedFactor = Number(value);
        });
      
      // Botón para restablecer a velocidad predeterminada
      speedFolder.add({
        resetSpeed: () => {
          this.playerController.velocity = this.playerController.defaultSpeed;
        }
      }, 'resetSpeed').name('Restablecer velocidad');
      
      // Abrir la carpeta de velocidad por defecto
      speedFolder.open();
    }
    
    // Configuración para el tamaño y rotación de los bloques de carretera
    const roadDimensionsFolder = roadFolder.addFolder('Dimensiones de Carretera');
    
    // Tamaño del bloque con nombres más descriptivos
    const roadBlockSettings = {
      width: 20,     // Ancho de carretera (eje X)
      height: 20,    // Altura/grosor (eje Y)
      length: 20,    // Largo del segmento (eje Z)
      rotationDeg: 90  // Rotación en grados (más intuitivo que radianes)
    };
    
    // Ancho de la carretera (eje X)
    roadDimensionsFolder.add(roadBlockSettings, 'width', 10, 50)
      .name('Ancho de carretera (X) - Afecta el espacio entre carriles')
      .onChange(value => {
        if (this.roadManager) {
          this.roadManager.updateScale('x', value);
        }
      });
    
    // Altura/grosor de la carretera (eje Y)
    roadDimensionsFolder.add(roadBlockSettings, 'height', 1, 30)
      .name('Grosor de carretera (Y)')
      .onChange(value => {
        if (this.roadManager) {
          this.roadManager.updateScale('y', value);
        }
      });
    
    // Longitud del segmento de carretera (eje Z)
    roadDimensionsFolder.add(roadBlockSettings, 'length', 10, 40)
      .name('Largo del segmento (Z)')
      .onChange(value => {
        if (this.roadManager) {
          this.roadManager.updateScale('z', value);
        }
      });
    
    // Rotación del bloque en grados (más intuitivo que radianes)
    roadDimensionsFolder.add(roadBlockSettings, 'rotationDeg', 0, 360)
      .name('Rotación (grados) - 90° = carretera recta')
      .onChange(value => {
        if (this.roadManager && this.roadManager.roadModel) {
          // Convertir grados a radianes
          const radians = (value * Math.PI) / 180;
          this.updateRoadBlockRotation(radians);
        }
      });
    
    // Control para el porcentaje de carretera usado para los carriles
    roadDimensionsFolder.add(this.roadManager, 'laneAreaPercentage', 0.5, 1, 0.05)
      .name('% Área para carriles')
      .onChange(() => {
        // No necesitamos reiniciar la carretera, solo afecta a la posición de los carriles
      });
    
    // Guardar configuración para acceso desde roadManager
    this.roadBlockSettings = roadBlockSettings;
    
    // Segmentos visibles
    roadFolder.add(this.roadManager, 'visibleSegments', 10, 40, 1)
      .name('Cantidad de segmentos (70% delante, 30% detrás)')
      .onChange(() => {
        this.roadManager.reset();
      });
    
    // Botón para reiniciar
    roadFolder.add({ resetRoad: () => this.roadManager.reset() }, 'resetRoad')
      .name('Reiniciar carretera');
    
    // Abrir las carpetas para mejor usabilidad
    roadFolder.open();
    roadDimensionsFolder.open();
  }

  setupInstructions() {
    const instructionsFolder = this.gui.addFolder('Instrucciones');
    
    const instructions = {
      showControls: () => {
        alert("Controles:\n" +
              "- Flecha Izquierda: Mover a carril izquierdo\n" +
              "- Flecha Derecha: Mover a carril derecho\n" +
              "- Flecha Arriba: Aumentar velocidad\n" +
              "- Flecha Abajo: Reducir velocidad");
      }
    };
    
    instructionsFolder.add(instructions, 'showControls')
      .name('Mostrar controles');
  }

  updateRoadBlockScale(value, axis) {
    // Actualizar el modelo de referencia
    this.roadManager.roadModel.scale[axis] = value;
    
    // Actualizar todos los segmentos existentes
    for (const segment of this.roadManager.roadSegments) {
      segment.model.scale[axis] = value;
    }
  }

  updateRoadBlockRotation(value) {
    // Actualizar el modelo de referencia
    this.roadManager.roadModel.rotation.y = value;
    
    // Actualizar todos los segmentos existentes
    for (const segment of this.roadManager.roadSegments) {
      segment.model.rotation.y = value;
    }
    
    // Actualizar el valor en grados en la interfaz
    if (this.roadBlockSettings) {
      this.roadBlockSettings.rotationDeg = (value * 180 / Math.PI) % 360;
    }
  }

  setupEnvironmentFolder() {
    const environmentFolder = this.gui.addFolder('Ambiente');
    
    // Grupo para controlar el color del cielo
    const skySettings = {
      // Convertir el color hexadecimal a objeto con propiedades r, g, b
      color: this.rgbToHex(this.scene.background)
    };
    
    // Control para el color del cielo
    environmentFolder.addColor(skySettings, 'color')
      .name('Color del cielo')
      .onChange(value => {
        // Actualizar el color del cielo con el nuevo valor
        this.scene.background = new THREE.Color(value);
        
        // Si la niebla está utilizando el mismo color, actualizarla también
        if (this.scene.fog) {
          this.scene.fog.color = new THREE.Color(value);
        }
      });
    
    // Grupo para controlar la niebla
    const fogSettings = {
      enabled: !!this.scene.fog,
      near: this.scene.fog ? this.scene.fog.near : 50,
      far: this.scene.fog ? this.scene.fog.far : 200
    };
    
    // Habilitar/deshabilitar niebla
    environmentFolder.add(fogSettings, 'enabled')
      .name('Activar niebla')
      .onChange(value => {
        if (value) {
          // Crear nueva niebla con los valores actuales
          this.scene.fog = new THREE.Fog(
            this.scene.background,
            fogSettings.near,
            fogSettings.far
          );
        } else {
          // Eliminar niebla
          this.scene.fog = null;
        }
      });
    
    // Control para la distancia cercana de la niebla
    environmentFolder.add(fogSettings, 'near', 0, 100)
      .name('Niebla - Distancia cerca')
      .onChange(value => {
        if (this.scene.fog) {
          this.scene.fog.near = value;
        }
      });
    
    // Control para la distancia lejana de la niebla
    environmentFolder.add(fogSettings, 'far', 50, 500)
      .name('Niebla - Distancia lejos')
      .onChange(value => {
        if (this.scene.fog) {
          this.scene.fog.far = value;
        }
      });
    
    // Abrir la carpeta por defecto
    environmentFolder.open();
  }
  
  // Método auxiliar para convertir un color THREE.Color a formato hexadecimal para la GUI
  rgbToHex(color) {
    return '#' + color.getHexString();
  }

  setupPostProcessingFolder() {
    // Si no hay gestor de post-procesamiento, no hacemos nada
    if (!this.postProcessing) return;
    
    const postProcessingFolder = this.gui.addFolder('Post-Procesamiento');
    
    // Obtener parámetros básicos de post-procesamiento
    const params = this.postProcessing.getDofParams();
    
    // Control básico de activación
    postProcessingFolder.add(params, 'enabled')
      .name('Activar post-procesamiento')
      .onChange(value => {
        this.postProcessing.setEnabled(value);
      });
    
    // Control de exposición
    postProcessingFolder.add(params, 'exposure', 0, 2, 0.01)
      .name('Exposición')
      .onChange(value => {
        this.postProcessing.setExposure(value);
      });
    
    // Abrir carpeta por defecto
    postProcessingFolder.open();
  }

  setupPlayerFolder() {
    if (!this.playerController) return;
    
    const playerFolder = this.gui.addFolder('Jugador');
    
    // Solo dejamos abierta la carpeta del jugador, sin añadir controles para el trail
    playerFolder.open();
  }

  destroy() {
    if (this.gui) this.gui.destroy();
  }
}