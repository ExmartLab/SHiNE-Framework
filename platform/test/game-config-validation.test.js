import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const gameConfigPath = path.resolve('./src/game.json');
let gameConfig;

beforeAll(() => {
  const rawData = fs.readFileSync(gameConfigPath, 'utf8');
  gameConfig = JSON.parse(rawData);
});

describe('Game Configuration Schema Validation', () => {
  
  describe('Environment Section', () => {
    it('should have a valid environment object', () => {
      expect(gameConfig).toHaveProperty('environment');
      expect(gameConfig.environment).toBeTypeOf('object');
    });

    it('should have valid time configuration', () => {
      expect(gameConfig.environment).toHaveProperty('time');
      expect(gameConfig.environment.time).toBeTypeOf('object');
    });

    it('should have valid startTime configuration', () => {
      const { startTime } = gameConfig.environment.time;
      expect(startTime).toHaveProperty('hour');
      expect(startTime).toHaveProperty('minute');
      
      expect(startTime.hour).toBeTypeOf('number');
      expect(startTime.minute).toBeTypeOf('number');
      
      expect(startTime.hour).toBeGreaterThanOrEqual(0);
      expect(startTime.hour).toBeLessThanOrEqual(23);
      expect(startTime.minute).toBeGreaterThanOrEqual(0);
      expect(startTime.minute).toBeLessThanOrEqual(59);
    });

    it('should have valid speed configuration', () => {
      const { speed } = gameConfig.environment.time;
      expect(speed).toBeTypeOf('number');
      expect(speed).toBeGreaterThan(0);
    });
  });

  describe('Rules Section', () => {
    it('should have a rules array', () => {
      expect(gameConfig).toHaveProperty('rules');
      expect(Array.isArray(gameConfig.rules)).toBe(true);
    });

    it('should have valid rule structure', () => {
      gameConfig.rules.forEach((rule, index) => {
        expect(rule, `Rule ${index}`).toHaveProperty('id');
        expect(rule, `Rule ${index}`).toHaveProperty('name');
        expect(rule, `Rule ${index}`).toHaveProperty('precondition');
        expect(rule, `Rule ${index}`).toHaveProperty('action');
        
        expect(rule.id, `Rule ${index} id`).toBeTypeOf('string');
        expect(rule.name, `Rule ${index} name`).toBeTypeOf('string');
        expect(Array.isArray(rule.precondition), `Rule ${index} precondition`).toBe(true);
        expect(Array.isArray(rule.action), `Rule ${index} action`).toBe(true);
        
        expect(rule.precondition.length, `Rule ${index} precondition length`).toBeGreaterThan(0);
        expect(rule.action.length, `Rule ${index} action length`).toBeGreaterThan(0);
      });
    });

    it('should have valid precondition types', () => {
      gameConfig.rules.forEach((rule, ruleIndex) => {
        rule.precondition.forEach((precond, precondIndex) => {
          expect(precond, `Rule ${ruleIndex} precondition ${precondIndex}`).toHaveProperty('type');
          expect(['Device', 'Time', 'Context'], `Rule ${ruleIndex} precondition ${precondIndex} type`).toContain(precond.type);
          
          if (precond.type === 'Device') {
            expect(precond, `Rule ${ruleIndex} precondition ${precondIndex}`).toHaveProperty('device');
            expect(precond, `Rule ${ruleIndex} precondition ${precondIndex}`).toHaveProperty('condition');
            expect(precond.device, `Rule ${ruleIndex} precondition ${precondIndex} device`).toBeTypeOf('string');
            
            const { condition } = precond;
            expect(condition).toHaveProperty('name');
            expect(condition).toHaveProperty('operator');
            expect(condition).toHaveProperty('value');
            expect(['<=', '>', '<', '>=', '==', '!=']).toContain(condition.operator);
            expect(typeof condition.value === 'number' || typeof condition.value === 'boolean' || typeof condition.value === 'string').toBe(true);
          }
          
          if (precond.type === 'Time' || precond.type === 'Context') {
            expect(precond, `Rule ${ruleIndex} precondition ${precondIndex}`).toHaveProperty('condition');
            const { condition } = precond;
            expect(condition).toHaveProperty('operator');
            expect(condition).toHaveProperty('value');
            expect(['<=', '>', '<', '>=', '==', '!=']).toContain(condition.operator);
          }
        });
      });
    });

    it('should have valid action types', () => {
      gameConfig.rules.forEach((rule, ruleIndex) => {
        rule.action.forEach((action, actionIndex) => {
          expect(action, `Rule ${ruleIndex} action ${actionIndex}`).toHaveProperty('type');
          expect(['Device_Interaction', 'Explanation'], `Rule ${ruleIndex} action ${actionIndex} type`).toContain(action.type);
          
          if (action.type === 'Device_Interaction') {
            expect(action, `Rule ${ruleIndex} action ${actionIndex}`).toHaveProperty('device');
            expect(action, `Rule ${ruleIndex} action ${actionIndex}`).toHaveProperty('interaction');
            expect(action.device, `Rule ${ruleIndex} action ${actionIndex} device`).toBeTypeOf('string');
            
            const { interaction } = action;
            expect(interaction).toHaveProperty('name');
            expect(interaction).toHaveProperty('value');
            expect(interaction.name).toBeTypeOf('string');
            expect(typeof interaction.value === 'number' || typeof interaction.value === 'boolean' || typeof interaction.value === 'string').toBe(true);
          }
          
          if (action.type === 'Explanation') {
            expect(action, `Rule ${ruleIndex} action ${actionIndex}`).toHaveProperty('explanation');
            expect(action.explanation, `Rule ${ruleIndex} action ${actionIndex} explanation`).toBeTypeOf('string');
          }
        });
      });
    });

    it('should have valid delay values when present', () => {
      gameConfig.rules.forEach((rule, index) => {
        if (rule.delay !== undefined) {
          expect(rule.delay, `Rule ${index} delay`).toBeTypeOf('number');
          expect(rule.delay, `Rule ${index} delay`).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });

  describe('Tasks Section', () => {
    it('should have a valid tasks object', () => {
      expect(gameConfig).toHaveProperty('tasks');
      expect(gameConfig.tasks).toBeTypeOf('object');
    });

    it('should have valid task metadata', () => {
      const { tasks } = gameConfig;
      
      if (tasks.ordered !== undefined) {
        expect(['true', 'false']).toContain(tasks.ordered);
      }
      
      if (tasks.timer !== undefined) {
        expect(tasks.timer).toBeTypeOf('number');
      }
      
      if (tasks.abortable !== undefined) {
        expect(tasks.abortable).toBeTypeOf('boolean');
      }
    });

    it('should have a valid tasks array', () => {
      expect(gameConfig.tasks).toHaveProperty('tasks');
      expect(Array.isArray(gameConfig.tasks.tasks)).toBe(true);
      expect(gameConfig.tasks.tasks.length).toBeGreaterThan(0);
    });

    it('should have valid task structure', () => {
      gameConfig.tasks.tasks.forEach((task, index) => {
        expect(task, `Task ${index}`).toHaveProperty('id');
        expect(task, `Task ${index}`).toHaveProperty('description');
        expect(task, `Task ${index}`).toHaveProperty('environment');
        expect(task, `Task ${index}`).toHaveProperty('defaultDeviceProperties');
        expect(task, `Task ${index}`).toHaveProperty('goals');
        
        expect(task.id, `Task ${index} id`).toBeTypeOf('string');
        expect(task.description, `Task ${index} description`).toBeTypeOf('string');
        expect(Array.isArray(task.environment), `Task ${index} environment`).toBe(true);
        expect(Array.isArray(task.defaultDeviceProperties), `Task ${index} defaultDeviceProperties`).toBe(true);
        expect(Array.isArray(task.goals), `Task ${index} goals`).toBe(true);
        expect(task.goals.length, `Task ${index} goals length`).toBeGreaterThan(0);
      });
    });

    it('should have valid task timers when present', () => {
      gameConfig.tasks.tasks.forEach((task, index) => {
        if (task.timer !== undefined) {
          expect(task.timer, `Task ${index} timer`).toBeTypeOf('number');
        }
      });
    });

    it('should have valid environment variables', () => {
      gameConfig.tasks.tasks.forEach((task, taskIndex) => {
        task.environment.forEach((env, envIndex) => {
          expect(env, `Task ${taskIndex} environment ${envIndex}`).toHaveProperty('name');
          expect(env, `Task ${taskIndex} environment ${envIndex}`).toHaveProperty('value');
          expect(env.name, `Task ${taskIndex} environment ${envIndex} name`).toBeTypeOf('string');
          expect(typeof env.value === 'string' || typeof env.value === 'number').toBe(true);
        });
      });
    });

    it('should have valid default device properties', () => {
      gameConfig.tasks.tasks.forEach((task, taskIndex) => {
        task.defaultDeviceProperties.forEach((deviceProp, deviceIndex) => {
          expect(deviceProp, `Task ${taskIndex} device ${deviceIndex}`).toHaveProperty('device');
          expect(deviceProp, `Task ${taskIndex} device ${deviceIndex}`).toHaveProperty('properties');
          expect(deviceProp.device, `Task ${taskIndex} device ${deviceIndex} device`).toBeTypeOf('string');
          expect(Array.isArray(deviceProp.properties), `Task ${taskIndex} device ${deviceIndex} properties`).toBe(true);
          
          deviceProp.properties.forEach((prop, propIndex) => {
            expect(prop, `Task ${taskIndex} device ${deviceIndex} property ${propIndex}`).toHaveProperty('name');
            expect(prop, `Task ${taskIndex} device ${deviceIndex} property ${propIndex}`).toHaveProperty('value');
            expect(prop.name, `Task ${taskIndex} device ${deviceIndex} property ${propIndex} name`).toBeTypeOf('string');
            expect(typeof prop.value === 'number' || typeof prop.value === 'boolean').toBe(true);
          });
        });
      });
    });

    it('should have valid goals', () => {
      gameConfig.tasks.tasks.forEach((task, taskIndex) => {
        task.goals.forEach((goal, goalIndex) => {
          expect(goal, `Task ${taskIndex} goal ${goalIndex}`).toHaveProperty('device');
          expect(goal, `Task ${taskIndex} goal ${goalIndex}`).toHaveProperty('condition');
          expect(goal.device, `Task ${taskIndex} goal ${goalIndex} device`).toBeTypeOf('string');
          
          const { condition } = goal;
          expect(condition).toHaveProperty('name');
          expect(condition).toHaveProperty('operator');
          expect(condition).toHaveProperty('value');
          expect(condition.name).toBeTypeOf('string');
          expect(['<=', '>', '<', '>=', '==', '!=']).toContain(condition.operator);
          expect(typeof condition.value === 'number' || typeof condition.value === 'boolean').toBe(true);
        });
      });
    });
  });

  describe('Rooms Section', () => {
    it('should have a rooms array', () => {
      expect(gameConfig).toHaveProperty('rooms');
      expect(Array.isArray(gameConfig.rooms)).toBe(true);
    });

    it('should have valid room structure', () => {
      gameConfig.rooms.forEach((room, index) => {
        expect(room, `Room ${index}`).toHaveProperty('name');
        expect(room, `Room ${index}`).toHaveProperty('walls');
        expect(room.name, `Room ${index} name`).toBeTypeOf('string');
        expect(Array.isArray(room.walls), `Room ${index} walls`).toBe(true);
        expect(room.walls.length, `Room ${index} walls length`).toBe(4);
      });
    });

    it('should have valid wall structure', () => {
      gameConfig.rooms.forEach((room, roomIndex) => {
        room.walls.forEach((wall, wallIndex) => {
          expect(wall, `Room ${roomIndex} wall ${wallIndex}`).toHaveProperty('image');
          expect(wall.image, `Room ${roomIndex} wall ${wallIndex} image`).toBeTypeOf('string');
          
          if (wall.default !== undefined) {
            expect(wall.default, `Room ${roomIndex} wall ${wallIndex} default`).toBeTypeOf('boolean');
          }
        });
      });
    });

    it('should have valid device structure when present', () => {
      gameConfig.rooms.forEach((room, roomIndex) => {
        room.walls.forEach((wall, wallIndex) => {
          if (wall.devices) {
            expect(Array.isArray(wall.devices), `Room ${roomIndex} wall ${wallIndex} devices`).toBe(true);
            
            wall.devices.forEach((device, deviceIndex) => {
              expect(device, `Room ${roomIndex} wall ${wallIndex} device ${deviceIndex}`).toHaveProperty('name');
              expect(device, `Room ${roomIndex} wall ${wallIndex} device ${deviceIndex}`).toHaveProperty('id');
              expect(device, `Room ${roomIndex} wall ${wallIndex} device ${deviceIndex}`).toHaveProperty('image');
              expect(device, `Room ${roomIndex} wall ${wallIndex} device ${deviceIndex}`).toHaveProperty('position');
              expect(device, `Room ${roomIndex} wall ${wallIndex} device ${deviceIndex}`).toHaveProperty('interactions');
              expect(device, `Room ${roomIndex} wall ${wallIndex} device ${deviceIndex}`).toHaveProperty('visualState');
              
              expect(device.name).toBeTypeOf('string');
              expect(device.id).toBeTypeOf('string');
              expect(device.image).toBeTypeOf('string');
              expect(Array.isArray(device.interactions)).toBe(true);
              expect(Array.isArray(device.visualState)).toBe(true);
              expect(device.visualState.length).toBeGreaterThan(0);
            });
          }
        });
      });
    });

    it('should have valid device position', () => {
      gameConfig.rooms.forEach((room, roomIndex) => {
        room.walls.forEach((wall, wallIndex) => {
          if (wall.devices) {
            wall.devices.forEach((device, deviceIndex) => {
              const { position } = device;
              expect(position, `Room ${roomIndex} wall ${wallIndex} device ${deviceIndex} position`).toHaveProperty('x');
              expect(position, `Room ${roomIndex} wall ${wallIndex} device ${deviceIndex} position`).toHaveProperty('y');
              expect(position, `Room ${roomIndex} wall ${wallIndex} device ${deviceIndex} position`).toHaveProperty('scale');
              expect(position, `Room ${roomIndex} wall ${wallIndex} device ${deviceIndex} position`).toHaveProperty('origin');
              
              expect(position.x).toBeTypeOf('number');
              expect(position.y).toBeTypeOf('number');
              expect(position.scale).toBeTypeOf('number');
              expect(position.origin).toBeTypeOf('number');
              
              expect(position.x).toBeGreaterThanOrEqual(0);
              expect(position.y).toBeGreaterThanOrEqual(0);
              expect(position.scale).toBeGreaterThan(0);
              expect(position.origin).toBeGreaterThanOrEqual(0);
              expect(position.origin).toBeLessThanOrEqual(1);
            });
          }
        });
      });
    });

    it('should have valid door structure when present', () => {
      gameConfig.rooms.forEach((room, roomIndex) => {
        room.walls.forEach((wall, wallIndex) => {
          if (wall.doors) {
            expect(Array.isArray(wall.doors), `Room ${roomIndex} wall ${wallIndex} doors`).toBe(true);
            
            wall.doors.forEach((door, doorIndex) => {
              expect(door, `Room ${roomIndex} wall ${wallIndex} door ${doorIndex}`).toHaveProperty('image');
              expect(door, `Room ${roomIndex} wall ${wallIndex} door ${doorIndex}`).toHaveProperty('position');
              expect(door, `Room ${roomIndex} wall ${wallIndex} door ${doorIndex}`).toHaveProperty('destination');
              
              expect(door.image).toBeTypeOf('string');
              
              const { position } = door;
              expect(position).toHaveProperty('x');
              expect(position).toHaveProperty('y');
              expect(position.x).toBeTypeOf('number');
              expect(position.y).toBeTypeOf('number');
              
              const { destination } = door;
              expect(destination).toHaveProperty('room');
              expect(destination).toHaveProperty('wall');
              expect(destination.room).toBeTypeOf('string');
              expect(destination.wall).toBeTypeOf('string');
            });
          }
        });
      });
    });
  });

  describe('Device Interactions', () => {
    it('should have valid interaction types', () => {
      const validInteractionTypes = ['Boolean_Action', 'Numerical_Action', 'Dynamic_Property', 'Generic_Action', 'Stateless_Action'];
      
      gameConfig.rooms.forEach((room, roomIndex) => {
        room.walls.forEach((wall, wallIndex) => {
          if (wall.devices) {
            wall.devices.forEach((device, deviceIndex) => {
              device.interactions.forEach((interaction, interactionIndex) => {
                expect(interaction, `Room ${roomIndex} wall ${wallIndex} device ${deviceIndex} interaction ${interactionIndex}`).toHaveProperty('InteractionType');
                expect(interaction, `Room ${roomIndex} wall ${wallIndex} device ${deviceIndex} interaction ${interactionIndex}`).toHaveProperty('name');
                expect(interaction, `Room ${roomIndex} wall ${wallIndex} device ${deviceIndex} interaction ${interactionIndex}`).toHaveProperty('currentState');
                
                expect(validInteractionTypes).toContain(interaction.InteractionType);
                expect(interaction.name).toBeTypeOf('string');
                expect(interaction.currentState).toBeTypeOf('object');
                expect(interaction.currentState).toHaveProperty('visible');
              });
            });
          }
        });
      });
    });

    it('should have valid Boolean_Action interactions', () => {
      gameConfig.rooms.forEach((room, roomIndex) => {
        room.walls.forEach((wall, wallIndex) => {
          if (wall.devices) {
            wall.devices.forEach((device, deviceIndex) => {
              device.interactions.forEach((interaction, interactionIndex) => {
                if (interaction.InteractionType === 'Boolean_Action') {
                  expect(interaction, `Boolean_Action ${roomIndex}-${wallIndex}-${deviceIndex}-${interactionIndex}`).toHaveProperty('inputData');
                  
                  const { inputData, currentState } = interaction;
                  expect(inputData).toHaveProperty('valueType');
                  expect(inputData).toHaveProperty('type');
                  expect(Array.isArray(inputData.valueType)).toBe(true);
                  expect(inputData.valueType).toContain('PrimitiveType');
                  expect(inputData.valueType).toContain('Boolean');
                  
                  expect(inputData.type).toHaveProperty('True');
                  expect(inputData.type).toHaveProperty('False');
                  expect(inputData.type.True).toBeTypeOf('string');
                  expect(inputData.type.False).toBeTypeOf('string');
                  
                  expect(currentState).toHaveProperty('value');
                  expect(currentState.value).toBeTypeOf('boolean');
                }
              });
            });
          }
        });
      });
    });

    it('should have valid Numerical_Action interactions', () => {
      gameConfig.rooms.forEach((room, roomIndex) => {
        room.walls.forEach((wall, wallIndex) => {
          if (wall.devices) {
            wall.devices.forEach((device, deviceIndex) => {
              device.interactions.forEach((interaction, interactionIndex) => {
                if (interaction.InteractionType === 'Numerical_Action') {
                  expect(interaction, `Numerical_Action ${roomIndex}-${wallIndex}-${deviceIndex}-${interactionIndex}`).toHaveProperty('inputData');
                  
                  const { inputData, currentState } = interaction;
                  expect(inputData).toHaveProperty('valueType');
                  expect(inputData).toHaveProperty('unitOfMeasure');
                  expect(inputData).toHaveProperty('type');
                  expect(Array.isArray(inputData.valueType)).toBe(true);
                  expect(inputData.valueType).toContain('PrimitiveType');
                  expect(inputData.valueType).toContain('Integer');
                  expect(inputData.unitOfMeasure).toBeTypeOf('string');
                  
                  expect(inputData.type).toHaveProperty('Range');
                  expect(inputData.type).toHaveProperty('Interval');
                  expect(Array.isArray(inputData.type.Range)).toBe(true);
                  expect(Array.isArray(inputData.type.Interval)).toBe(true);
                  expect(inputData.type.Range.length).toBe(2);
                  expect(inputData.type.Interval.length).toBe(1);
                  
                  expect(currentState).toHaveProperty('value');
                  expect(currentState.value).toBeTypeOf('number');
                }
              });
            });
          }
        });
      });
    });

    it('should have valid Generic_Action interactions', () => {
      gameConfig.rooms.forEach((room, roomIndex) => {
        room.walls.forEach((wall, wallIndex) => {
          if (wall.devices) {
            wall.devices.forEach((device, deviceIndex) => {
              device.interactions.forEach((interaction, interactionIndex) => {
                if (interaction.InteractionType === 'Generic_Action') {
                  expect(interaction, `Generic_Action ${roomIndex}-${wallIndex}-${deviceIndex}-${interactionIndex}`).toHaveProperty('inputData');
                  
                  const { inputData, currentState } = interaction;
                  expect(inputData).toHaveProperty('valueType');
                  expect(inputData).toHaveProperty('type');
                  expect(Array.isArray(inputData.valueType)).toBe(true);
                  expect(inputData.valueType).toContain('PrimitiveType');
                  expect(inputData.valueType).toContain('String');
                  
                  expect(inputData.type).toHaveProperty('String');
                  expect(inputData.type.String).toHaveProperty('Options');
                  expect(Array.isArray(inputData.type.String.Options)).toBe(true);
                  expect(inputData.type.String.Options.length).toBeGreaterThan(0);
                  
                  expect(currentState).toHaveProperty('value');
                  expect(currentState.value).toBeTypeOf('string');
                }
              });
            });
          }
        });
      });
    });

    it('should have valid Dynamic_Property interactions', () => {
      gameConfig.rooms.forEach((room, roomIndex) => {
        room.walls.forEach((wall, wallIndex) => {
          if (wall.devices) {
            wall.devices.forEach((device, deviceIndex) => {
              device.interactions.forEach((interaction, interactionIndex) => {
                if (interaction.InteractionType === 'Dynamic_Property') {
                  expect(interaction, `Dynamic_Property ${roomIndex}-${wallIndex}-${deviceIndex}-${interactionIndex}`).toHaveProperty('outputData');
                  
                  const { outputData, currentState } = interaction;
                  expect(outputData).toHaveProperty('valueType');
                  expect(Array.isArray(outputData.valueType)).toBe(true);
                  expect(outputData.valueType).toContain('PrimitiveType');
                  expect(outputData.valueType).toContain('String');
                  
                  expect(currentState).toHaveProperty('value');
                  expect(currentState.value).toBeTypeOf('string');
                }
              });
            });
          }
        });
      });
    });

    it('should have valid Stateless_Action interactions', () => {
      gameConfig.rooms.forEach((room, roomIndex) => {
        room.walls.forEach((wall, wallIndex) => {
          if (wall.devices) {
            wall.devices.forEach((device, deviceIndex) => {
              device.interactions.forEach((interaction, interactionIndex) => {
                if (interaction.InteractionType === 'Stateless_Action') {
                  expect(interaction, `Stateless_Action ${roomIndex}-${wallIndex}-${deviceIndex}-${interactionIndex}`).toHaveProperty('inputData');
                  
                  const { inputData } = interaction;
                  expect(inputData).toHaveProperty('valueType');
                  expect(inputData).toHaveProperty('unitOfMeasure');
                  expect(Array.isArray(inputData.valueType)).toBe(true);
                  expect(inputData.valueType).toContain('null');
                  expect(inputData.unitOfMeasure).toBe('null');
                }
              });
            });
          }
        });
      });
    });
  });

  describe('Visual States', () => {
    it('should have valid visual state structure', () => {
      gameConfig.rooms.forEach((room, roomIndex) => {
        room.walls.forEach((wall, wallIndex) => {
          if (wall.devices) {
            wall.devices.forEach((device, deviceIndex) => {
              device.visualState.forEach((visualState, visualIndex) => {
                expect(visualState, `Room ${roomIndex} wall ${wallIndex} device ${deviceIndex} visual ${visualIndex}`).toHaveProperty('image');
                expect(visualState.image).toBeTypeOf('string');
                
                if (visualState.default !== undefined) {
                  expect(visualState.default).toBeTypeOf('boolean');
                }
                
                if (visualState.conditions) {
                  expect(Array.isArray(visualState.conditions)).toBe(true);
                  visualState.conditions.forEach((condition, conditionIndex) => {
                    expect(condition, `Visual condition ${conditionIndex}`).toHaveProperty('name');
                    expect(condition, `Visual condition ${conditionIndex}`).toHaveProperty('value');
                    expect(condition.name).toBeTypeOf('string');
                    
                    if (condition.operator !== undefined) {
                      expect(['<=', '>', '<', '>=', '==', '!=']).toContain(condition.operator);
                    }
                  });
                }
              });
            });
          }
        });
      });
    });

    it('should have at least one default visual state per device', () => {
      gameConfig.rooms.forEach((room, roomIndex) => {
        room.walls.forEach((wall, wallIndex) => {
          if (wall.devices) {
            wall.devices.forEach((device, deviceIndex) => {
              const hasDefault = device.visualState.some(vs => vs.default === true);
              expect(hasDefault, `Room ${roomIndex} wall ${wallIndex} device ${deviceIndex} should have default visual state`).toBe(true);
            });
          }
        });
      });
    });
  });

  describe('Overall Configuration Integrity', () => {
    it('should have all required top-level properties', () => {
      expect(gameConfig).toHaveProperty('environment');
      expect(gameConfig).toHaveProperty('rules');
      expect(gameConfig).toHaveProperty('tasks');
      expect(gameConfig).toHaveProperty('rooms');
    });

    it('should have consistent device references between tasks and rooms', () => {
      const deviceIds = new Set();
      
      // Collect all device IDs from rooms
      gameConfig.rooms.forEach(room => {
        room.walls.forEach(wall => {
          if (wall.devices) {
            wall.devices.forEach(device => {
              deviceIds.add(device.id);
            });
          }
        });
      });
      
      // Check that task device references exist
      gameConfig.tasks.tasks.forEach((task, taskIndex) => {
        task.defaultDeviceProperties.forEach((deviceProp, deviceIndex) => {
          expect(deviceIds.has(deviceProp.device), 
            `Task ${taskIndex} references non-existent device: ${deviceProp.device}`).toBe(true);
        });
        
        task.goals.forEach((goal, goalIndex) => {
          expect(deviceIds.has(goal.device), 
            `Task ${taskIndex} goal ${goalIndex} references non-existent device: ${goal.device}`).toBe(true);
        });
      });
    });

    it('should have consistent device references in rules', () => {
      const deviceIds = new Set();
      
      // Collect all device IDs from rooms
      gameConfig.rooms.forEach(room => {
        room.walls.forEach(wall => {
          if (wall.devices) {
            wall.devices.forEach(device => {
              deviceIds.add(device.id);
            });
          }
        });
      });
      
      // Check that rule device references exist
      gameConfig.rules.forEach((rule, ruleIndex) => {
        rule.precondition.forEach((precond, precondIndex) => {
          if (precond.type === 'Device') {
            expect(deviceIds.has(precond.device), 
              `Rule ${ruleIndex} precondition ${precondIndex} references non-existent device: ${precond.device}`).toBe(true);
          }
        });
        
        rule.action.forEach((action, actionIndex) => {
          if (action.type === 'Device_Interaction') {
            expect(deviceIds.has(action.device), 
              `Rule ${ruleIndex} action ${actionIndex} references non-existent device: ${action.device}`).toBe(true);
          }
        });
      });
    });

    it('should have valid room references in doors', () => {
      const roomNames = new Set(gameConfig.rooms.map(room => room.name.toLowerCase().replace(' ', '_')));
      
      gameConfig.rooms.forEach((room, roomIndex) => {
        room.walls.forEach((wall, wallIndex) => {
          if (wall.doors) {
            wall.doors.forEach((door, doorIndex) => {
              expect(roomNames.has(door.destination.room), 
                `Room ${roomIndex} wall ${wallIndex} door ${doorIndex} references non-existent room: ${door.destination.room}`).toBe(true);
            });
          }
        });
      });
    });
  });
});