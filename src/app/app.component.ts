import { Component } from '@angular/core';
import * as PIXI from 'pixi.js'
import { fromEvent } from 'rxjs';
import { tap } from 'rxjs/operators';

export enum Direction {
  North,
  East,
  South,
  West
}

export enum KeyboardMap {
  Left = 37,
  Top = 38,
  Right = 39,
  Bottom = 40
}

export abstract class Actor extends PIXI.Graphics {
  update(delta: number, app?: PIXI.Application) {

  }

  onKeydown(e: KeyboardEvent) {

  }

  onKeyup(e: KeyboardEvent) {

  }

  lerp(start: number, end: number, amt: number) {
    return (1 - amt) * start + amt * end
  }
}

export class Background extends Actor {
  private space = 20;
  constructor() {
    super();

    this.beginFill(0x222222);
    var width = 20;
    for (let i = 0; i < width * width; i++) {
      this.drawRect(0, i * this.space, width * width * width, 1);
      this.drawRect(i * this.space, 0, 1, width * width * width);
    }
    this.endFill();
  }
}

export class SnakeCell extends Actor {
  public tileX: number;
  public tileY: number;

  private directionX: number = 1;
  private directionY: number = 0;

  private next: SnakeCell | undefined = void 0;
  private radius: number = 10;

  constructor(x: number, y: number, prev: SnakeCell) {
    super();

    this.tileX = x;
    this.tileY = y;

    if (prev) {
      prev.next = this;
    }

    this.beginFill(0xccefef);
    this.drawCircle(0, 0, this.radius);
    this.endFill();

    var worldPosition = this.getWorldPosition();
    this.position.x = worldPosition.x;
    this.position.y = worldPosition.y;
  }

  copy() {
    var snake = new SnakeCell(this.tileX, this.tileY, <any> undefined);
    snake.directionX = this.directionX;
    snake.directionY = this.directionY;
    snake.position = this.position;
    snake.next = this;
    return snake;
  }

  getWorldPosition() {
    return { x: (this.tileX * 20) + this.radius, y: (this.tileY * 20) + this.radius };
  }

  public getTilePosition() {
    return { x: this.tileX, y: this.tileY };
  }

  smoothUpdate(delta: number, app: PIXI.Application) {
    var speed = 60 / 1000;
    var position = this.getWorldPosition();
    this.position.x = this.lerp(this.position.x, position.x, speed * delta);
    this.position.y = this.lerp(this.position.y, position.y, speed * delta);
  }

  update() {
    if (!this.next) {
      this.tileX += this.directionX;
      this.tileY += this.directionY;
    } else {
      this.tileX = this.next.tileX;
      this.tileY = this.next.tileY;
    }
  }

  changeDirection(direction: Direction) {
    this.directionY = 0;
    this.directionX = 0;
    switch (direction) {
      case Direction.South:
        this.directionY = 1;
        return;
      case Direction.North:
        this.directionY = -1;
        return;
      case Direction.East:
        this.directionX = 1;
        return;
      case Direction.West:
        this.directionX = -1;
        return;
    }
  }
}

export interface IHashTable<TValue> {
  [key: number]: TValue;
}

export class Common {
  private static food: Food[] = [];

  public static addFood(food: Food) {
    Common.food.push(food);
  }

  public static removeFood(index: number) {
    if (index < 0) {
      return;
    }
    var food = Common.food[index];
    food.parent.removeChild(food);
    Common.food.splice(index, 1);
  }

  public static foodTest(x: number, y: number): number {
    var maxDistance = 10;
    for (let i = 0; i < Common.food.length; i++) {
      const food = Common.food[i];
      var dX = food.position.x - x;
      var dY = food.position.y - y;

      var prd = Math.sqrt(dX * dX + dY * dY);
      if (prd <= maxDistance) {
        return i;
      }
    }
    return -1;
  }
}

export class Snake extends Actor {
  private lastUnix: number = 0;
  private threshold: number = 100;

  private direction: Direction = Direction.East;

  private directionMap: IHashTable<Direction> = {};
  private oppositeDirectionMap: IHashTable<Direction> = {};

  constructor() {
    super();

    this.directionMap[KeyboardMap.Left] = Direction.West;
    this.directionMap[KeyboardMap.Right] = Direction.East;
    this.directionMap[KeyboardMap.Top] = Direction.North;
    this.directionMap[KeyboardMap.Bottom] = Direction.South;

    this.oppositeDirectionMap[Direction.East] = Direction.West;
    this.oppositeDirectionMap[Direction.West] = Direction.East;
    this.oppositeDirectionMap[Direction.South] = Direction.North;
    this.oppositeDirectionMap[Direction.North] = Direction.South;

    for (let i = 0; i < 4; i++) {
      this.addChild(new SnakeCell(this.children.length, 0, this.children[Math.max(0, this.children.length - 1)] as SnakeCell));
    }
  }

  update(delta: number, app: PIXI.Application) {
    var currentUnix = performance.now();
    var canResetUnix = false;
    for (let i = 0; i < this.children.length; i++) {
      const child = this.children[i] as SnakeCell;
      canResetUnix = currentUnix - this.lastUnix >= this.threshold;
      if (canResetUnix) {
        child.update();
      }
      child.smoothUpdate(delta, app);
    }
    if (canResetUnix) {
      this.lastUnix = performance.now();
    }

    var position = this.getPosition();
    var food = Common.foodTest(position.x, position.y);
    if (food > -1) {
      Common.removeFood(food);
      this.addChildAt((this.children[0] as SnakeCell).copy(), 0);
    }
  }

  override onKeydown(e: KeyboardEvent) {
    var direction = this.directionMap[e.keyCode];
    if (direction === undefined) {
      return;
    }

    if (this.oppositeDirectionMap[direction] === this.direction) {
      return;
    }

    var head = this.children[this.children.length - 1] as SnakeCell;
    head.changeDirection(direction);
    this.direction = direction;
  }

  getPosition() {
    return this.children[this.children.length - 1].position;
  }
}

export class Food extends Actor {
  private radius: number = 5;

  constructor(x: number, y: number) {
    super();

    this.beginFill(0xffffff);
    this.drawCircle(0, 0, this.radius);
    this.endFill();

    this.position.x = x;
    this.position.y = y;
  }
}

export class Camera extends Actor {
  private readonly _followTarget: Snake;
  private readonly _stage: PIXI.Container;
  constructor(followTarget: Snake, stage: PIXI.Container) {
    super();

    this._followTarget = followTarget;
    this._stage = stage;
  }

  update(delta: number) {
    var position = this._followTarget.getPosition();
    this._stage.setTransform((window.innerWidth / 2) - position.x, (window.innerHeight / 2) - position.y);
  }
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  private app: PIXI.Application = new PIXI.Application({
    width: window.innerWidth,
    height: window.innerHeight
  });

  private actors: Actor[] = [];

  ngOnInit(): void {
    document.body.appendChild(this.app.view);
    this.actors.push(new Background());
    const snake = new Snake();
    this.actors.push(snake);
    this.actors.push(new Camera(snake, this.app.stage));

    // Max X and Y that the foods will be placed
    var maxX = 100;
    var maxY = 100;
    
    // Default sizes for tile x and y
    var tileX = 20;
    var tileY = 20;
    for (let i = 0; i < 100; i++) {
      var x = Math.floor(Math.random() * maxX);
      var y = Math.floor(Math.random() * maxY);
      var food = new Food((x * tileX) + 5, (y * tileY) + 5);
      this.actors.push(food);
      Common.addFood(food);
    }

    this.initActors();
  }

  initActors() {
    /*
      Call actor update method per frame
    */
    for (let i = 0; i < this.actors.length; i++) {
      const actor = this.actors[i];
      this.app.stage.addChild(actor);
      this.app.ticker.add((e) => actor.update(e, this.app));
    }

    /*
      Capture key downs
    */
    fromEvent(document, 'keydown')
      .pipe(tap((e: any) => {
        for (let i = 0; i < this.actors.length; i++) {
          const actor = this.actors[i];
          actor.onKeydown(e);
        }
      })).subscribe();

    /*
      Capture key ups
    */
    fromEvent(document, 'keyup')
      .pipe(tap((e: any) => {
        for (let i = 0; i < this.actors.length; i++) {
          const actor = this.actors[i];
          actor.onKeyup(e);
        }
      })).subscribe();
  }
}
