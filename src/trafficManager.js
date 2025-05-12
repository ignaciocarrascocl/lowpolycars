import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export default class TrafficManager {
  constructor(scene, roadManager) {
    this.scene = scene;
    this.roadManager = roadManager;
    this.trafficCars = [];
    this.carModels = {};
    
    // Lista de modelos de coches disponibles
    this.carTypes = [
      'delivery.glb',
      'firetruck.glb',
      'garbage-truck.glb',
      'hatchback-sports.glb',
      'police.glb',
      'race-future.glb',
      'race.glb',
      'sedan-sports.glb',
      'sedan.glb',
      'suv-luxury.glb',
      'suv.glb',
      'taxi.glb',
      'tractor-police.glb',
      'tractor-shovel.glb',
      'tractor.glb',
      'truck-flat.glb',
      'truck.glb',
      'van.glb'
    ];
    
    // Configuración de carriles (cambiada según requisitos)
    this.incomingLanes = [0, 1]; // Carriles 1 y 2 (índices 0 y 1) para tráfico en sentido contrario
    this.outgoingLanes = [2, 3]; // Carriles 3 y 4 (índices 2 y 3) para tráfico en sentido avance
    
    // Configuraciones de tráfico separadas por tipo
    // Incoming (tráfico en sentido contrario)
    this.incomingConfig = {
      spawnDistance: 400,
      despawnDistance: 500,
      speed: 1.2, // Valor base para ambas direcciones
      speedVariation: 0, // Sin variación
      density: 0.6,
      minSpawnInterval: 0.3,
      maxSpawnInterval: 2.0,
    };
    
    // Outgoing (tráfico en el mismo sentido que el jugador)
    this.outgoingConfig = {
      spawnDistance: 400,
      despawnDistance: 500,
      speed: 1.2, // Mismo valor que incoming
      speedVariation: 0, // Sin variación
      density: 0.6,
      minSpawnInterval: 0.5,
      maxSpawnInterval: 2.5,
    };
    
    // Control de tiempo para generar coches
    this.lastIncomingSpawnTime = 0;
    this.lastOutgoingSpawnTime = 0;
    this.nextIncomingSpawnInterval = 0; // Intervalo inicial a 0 para generar coches inmediatamente
    this.nextOutgoingSpawnInterval = 0; // Intervalo inicial a 0 para generar coches inmediatamente
    
    // Ya no necesitamos controlar el primer coche de manera especial
    // Eliminamos estas banderas
    // this.firstIncomingCarSpawned = false;
    // this.firstOutgoingCarSpawned = false;
    
    // Inicializar carga de modelos
    this.init();
  }

  async init() {
    // Cargar los modelos de coches para tráfico
    await this.preloadCarModels();
  }

  async preloadCarModels() {
    const loader = new GLTFLoader();
    
    // Cargar todos los modelos de coches y guardarlos en el objeto carModels
    const loadPromises = this.carTypes.map(carType => {
      return new Promise((resolve) => {
        loader.load(`/models/cars/${carType}`, (gltf) => {
          // Configurar el modelo base
          const model = gltf.scene;
          
          // Aplicar sombras
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          
          // Guardar el modelo en nuestro objeto
          this.carModels[carType] = model;
          resolve();
        });
      });
    });
    
    // Esperar a que todos los modelos se carguen
    await Promise.all(loadPromises);
    
    console.log("Modelos de tráfico cargados:", Object.keys(this.carModels).length);
  }

  update(deltaTime, playerZPosition) {
    // Actualizar el tiempo para spawning de tráfico en sentido contrario (incoming)
    this.lastIncomingSpawnTime += deltaTime;
    
    // Comprobar si es momento de generar un nuevo coche en sentido contrario
    if (this.lastIncomingSpawnTime >= this.nextIncomingSpawnInterval) {
      this.spawnTrafficCar(playerZPosition, 'incoming');
      this.lastIncomingSpawnTime = 0;
      this.nextIncomingSpawnInterval = this.getRandomIncomingSpawnInterval();
    }
    
    // Actualizar el tiempo para spawning de tráfico en sentido de avance (outgoing)
    this.lastOutgoingSpawnTime += deltaTime;
    
    // Comprobar si es momento de generar un nuevo coche en sentido de avance
    if (this.lastOutgoingSpawnTime >= this.nextOutgoingSpawnInterval) {
      this.spawnTrafficCar(playerZPosition, 'outgoing');
      this.lastOutgoingSpawnTime = 0;
      this.nextOutgoingSpawnInterval = this.getRandomOutgoingSpawnInterval();
    }
    
    // Actualizar posición de todos los coches de tráfico
    this.updateTrafficCars(deltaTime, playerZPosition);
    
    // Eliminar coches que ya no son visibles
    this.cleanupTrafficCars(playerZPosition);
  }

  spawnTrafficCar(playerZPosition, direction) {
    // Si no hay modelos cargados, salir
    if (Object.keys(this.carModels).length === 0) return;
    
    // Limitar el número máximo de coches en el juego para mantener rendimiento
    const maxCarsPerDirection = 30; // Límite de coches por dirección (reducido de 60 a 30)
    const currentCarsInDirection = this.trafficCars.filter(car => car.direction === direction).length;
    
    if (currentCarsInDirection >= maxCarsPerDirection) {
      // En lugar de simplemente salir, podemos eliminar el coche más lejano
      // para hacer espacio para uno nuevo
      if (direction === 'incoming') {
        // Encontrar el coche incoming más lejano delante del jugador
        let farthestCarIndex = -1;
        let farthestDistance = -Infinity;
        
        for (let i = 0; i < this.trafficCars.length; i++) {
          const car = this.trafficCars[i];
          if (car.direction === direction) {
            // Para incoming, el más lejano es el que tiene Z más negativo
            const distance = playerZPosition - car.model.position.z;
            if (distance > farthestDistance) {
              farthestDistance = distance;
              farthestCarIndex = i;
            }
          }
        }
        
        // Si encontramos un coche para eliminar
        if (farthestCarIndex >= 0) {
          const carToRemove = this.trafficCars[farthestCarIndex];
          this.scene.remove(carToRemove.model);
          this.trafficCars.splice(farthestCarIndex, 1);
        }
      } else {
        // Encontrar el coche outgoing más lejano detrás del jugador
        let farthestCarIndex = -1;
        let farthestDistance = -Infinity;
        
        for (let i = 0; i < this.trafficCars.length; i++) {
          const car = this.trafficCars[i];
          if (car.direction === direction) {
            // Para outgoing, el más lejano detrás es el que tiene Z más positivo
            const distance = car.model.position.z - playerZPosition;
            if (distance > farthestDistance) {
              farthestDistance = distance;
              farthestCarIndex = i;
            }
          }
        }
        
        // Si encontramos un coche para eliminar
        if (farthestCarIndex >= 0) {
          const carToRemove = this.trafficCars[farthestCarIndex];
          this.scene.remove(carToRemove.model);
          this.trafficCars.splice(farthestCarIndex, 1);
        }
      }
    }
    
    // Seleccionar carriles y configuración según dirección
    const lanes = direction === 'incoming' ? this.incomingLanes : this.outgoingLanes;
    const config = direction === 'incoming' ? this.incomingConfig : this.outgoingConfig;
    
    if (lanes.length === 0) return; // No hay carriles configurados para esta dirección
    
    // Verificar si el carril ya tiene un coche cerca del punto de spawn
    // para evitar superposiciones
    const safeDistance = 10; // Distancia mínima entre coches al generarse
    let availableLanes = [...lanes];
    
    for (const car of this.trafficCars) {
      if (car.direction === direction) {
        const spawnPoint = direction === 'incoming' 
          ? playerZPosition - config.spawnDistance // Spawn delante del jugador para incoming
          : playerZPosition - config.spawnDistance; // Spawn delante del jugador para outgoing
        
        const carIsNearSpawn = Math.abs(car.model.position.z - spawnPoint) < safeDistance;
        
        if (carIsNearSpawn) {
          // Eliminar el carril del coche cercano de los disponibles
          availableLanes = availableLanes.filter(lane => lane !== car.lane);
        }
      }
    }
    
    if (availableLanes.length === 0) return; // No hay carriles seguros disponibles
    
    // Seleccionar un carril aleatorio para el tráfico
    const laneIndex = availableLanes[Math.floor(Math.random() * availableLanes.length)];
    
    // Seleccionar un modelo aleatorio
    const modelType = this.carTypes[Math.floor(Math.random() * this.carTypes.length)];
    const originalModel = this.carModels[modelType];
    
    if (!originalModel) return;
    
    // Clonar el modelo para este coche específico
    const carModel = originalModel.clone();
    
    // Posicionar el coche en el carril seleccionado
    const xPos = this.roadManager.getLanePosition(laneIndex);
    carModel.position.x = xPos;
    carModel.position.y = 0.2; // Altura sobre la carretera
    
    // Configurar según dirección
    if (direction === 'incoming') {
      // Tráfico en sentido contrario (hacia el jugador)
      carModel.rotation.y = 0; // 0 grados para ir en dirección contraria correctamente
      
      // Posicionar a la distancia configurada desde el jugador
      carModel.position.z = playerZPosition - config.spawnDistance;
      
      // Velocidad fija para coches entrantes (sin variación)
      const speed = config.speed;
      
      // Añadir el coche a nuestro array
      this.trafficCars.push({
        model: carModel,
        lane: laneIndex,
        speed: speed,
        direction: 'incoming'
      });
    } else {
      // Tráfico en sentido de avance (igual que el jugador)
      carModel.rotation.y = Math.PI; // 180 grados para ir en la misma dirección que el jugador
      
      // Posicionar a la distancia configurada sin multiplicar por un factor adicional
      carModel.position.z = playerZPosition - config.spawnDistance;
      
      // Velocidad fija para coches salientes (sin variación)
      const speed = config.speed;
      
      // Añadir el coche a nuestro array
      this.trafficCars.push({
        model: carModel,
        lane: laneIndex,
        speed: speed,
        direction: 'outgoing'
      });
    }
    
    // Aplicar una escala aleatoria para variedad visual
    const scale = 0.9 + Math.random() * 0.2; // Entre 0.9 y 1.1
    carModel.scale.set(scale, scale, scale);
    
    // Añadir el coche a la escena
    this.scene.add(carModel);
  }

  updateTrafficCars(deltaTime, playerZPosition) {
    // Factor de escala común para todos los coches
    const speedScaleFactor = 0.3;
    
    // Ahora los coches de tráfico avanzan por sí mismos con la misma velocidad base
    for (const car of this.trafficCars) {
      if (car.direction === 'incoming') {
        // Tráfico en sentido contrario avanza en Z positivo (hacia el jugador)
        car.model.position.z += car.speed * speedScaleFactor * deltaTime * 60;
        
        // Añadir pequeña variación aleatoria en la dirección para naturalidad
        if (Math.random() < 0.05) { // Solo ocasionalmente
          car.model.rotation.y = 0 + (Math.random() * 0.04 - 0.02);
        }
      } else {
        // Tráfico en sentido de avance se mueve en Z negativo (igual que el jugador)
        car.model.position.z -= car.speed * speedScaleFactor * deltaTime * 60;
        
        // Añadir pequeña variación aleatoria en la dirección para naturalidad
        if (Math.random() < 0.05) { // Solo ocasionalmente
          car.model.rotation.y = Math.PI + (Math.random() * 0.04 - 0.02);
        }
      }
    }
    
    // Mostrar información de depuración ocasionalmente
    if (Math.random() < 0.01) { // Aproximadamente cada 100 frames
      const incomingCount = this.trafficCars.filter(car => car.direction === 'incoming').length;
      const outgoingCount = this.trafficCars.filter(car => car.direction === 'outgoing').length;
      console.log(`Estado del tráfico: ${incomingCount} coches entrantes, ${outgoingCount} coches salientes`);
    }
  }

  cleanupTrafficCars(playerZPosition) {
    let i = this.trafficCars.length;
    let removedCars = 0;

    while (i--) {
      const car = this.trafficCars[i];
      const config = car.direction === 'incoming' ? this.incomingConfig : this.outgoingConfig;
      
      if (car.direction === 'incoming') {
        // Si el coche en sentido contrario ha sobrepasado al jugador (detrás)
        if (car.model.position.z > playerZPosition + config.despawnDistance) {
          this.scene.remove(car.model);
          this.trafficCars.splice(i, 1);
          removedCars++;
        }
      } else {
        // Para coches outgoing (misma dirección que el jugador), verificar si:
        // 1. Han quedado muy por detrás del jugador (Z muy positivo en relación al jugador)
        // 2. Han avanzado demasiado adelante del jugador (Z muy negativo)
        
        // Verificar si está muy atrás
        if (car.model.position.z > playerZPosition + config.despawnDistance) {
          this.scene.remove(car.model);
          this.trafficCars.splice(i, 1);
          removedCars++;
        }
        // Verificar si está muy adelante
        else if (car.model.position.z < playerZPosition - config.despawnDistance * 2) {
          this.scene.remove(car.model);
          this.trafficCars.splice(i, 1);
          removedCars++;
        }
      }
    }
    
    // Para depuración - solo muestra si realmente eliminamos coches
    if (removedCars > 0) {
      console.log(`Eliminados ${removedCars} coches de tráfico`);
    }
  }

  getRandomIncomingSpawnInterval() {
    // Para todos los coches, usar el cálculo normal basado en densidad
    const config = this.incomingConfig;
    const interval = config.maxSpawnInterval - 
                   ((config.maxSpawnInterval - config.minSpawnInterval) * config.density);
    
    // Añadir algo de aleatoriedad al intervalo (reducido para más frecuencia)
    return interval * (0.5 + Math.random() * 0.3); // ±30% de variación, base reducida
  }

  getRandomOutgoingSpawnInterval() {
    // Ajustar el intervalo según la densidad de tráfico
    // Mayor densidad = intervalos más cortos
    const config = this.outgoingConfig;
    const interval = config.maxSpawnInterval - 
                   ((config.maxSpawnInterval - config.minSpawnInterval) * config.density);
    
    // Añadir algo de aleatoriedad al intervalo
    return interval * (0.8 + Math.random() * 0.4); // ±20% de variación
  }

  // Métodos actualizados para cambiar configuraciones a través de la GUI
  updateIncomingDensity(value) {
    this.incomingConfig.density = value;
    // Actualizar intervalo para que tome efecto inmediatamente
    this.nextIncomingSpawnInterval = this.getRandomIncomingSpawnInterval();
  }

  updateOutgoingDensity(value) {
    this.outgoingConfig.density = value;
    // Actualizar intervalo para que tome efecto inmediatamente
    this.nextOutgoingSpawnInterval = this.getRandomOutgoingSpawnInterval();
  }

  updateIncomingSpeed(value) {
    this.incomingConfig.speed = value;
  }

  updateOutgoingSpeed(value) {
    this.outgoingConfig.speed = value;
  }

  updateIncomingSpeedVariation(value) {
    this.incomingConfig.speedVariation = value;
  }

  updateOutgoingSpeedVariation(value) {
    this.outgoingConfig.speedVariation = value;
  }

  getTrafficCars() {
    return this.trafficCars;
  }

  reset() {
    // Eliminar todos los coches de tráfico
    for (const car of this.trafficCars) {
      this.scene.remove(car.model);
    }
    this.trafficCars = [];
    
    // Reiniciar contadores de tiempo
    this.lastIncomingSpawnTime = 0;
    this.lastOutgoingSpawnTime = 0;
    this.nextIncomingSpawnInterval = this.getRandomIncomingSpawnInterval();
    this.nextOutgoingSpawnInterval = this.getRandomOutgoingSpawnInterval();
  }
}