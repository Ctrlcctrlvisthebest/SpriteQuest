"use strict";

const GameState = Object.freeze({ START: "START", LOADING: "LOADING", PLAYING: "PLAYING", VICTORY: "VICTORY", LOSE: "LOSE" });
const Difficulty = Object.freeze({ EASY: "EASY", NORMAL: "NORMAL", HARD: "HARD" });
const TILE_SIZE = 50;
const SPRITE_WIDTH = 50;
const SPRITE_HEIGHT = 50;
const MAP_COUNT = 4;
const GAME_WIDTH = 1500;
const GAME_HEIGHT = 800;

let state = GameState.START;
let selectedDifficulty = Difficulty.NORMAL;
let timerStart = 0;
const waitTime = 1000;
let world, mage, enemies = [], collectibles = [], projectiles = [], waterProjectiles = [];
let leftPressed = false, rightPressed = false, jumpPressed = false;
let resetMageRequested = false, resetGameRequested = false;
let rows = 0, cols = 0, worldWidth = 0, worldHeight = 0;
let viewX = 0, viewY = 0, coinScore = 0, mapNumber = 1;
let images = {}, sounds = {}, mapLines = {};

function preload() {
  const imageFiles = ["mageL", "mageR", "mageSprintL", "mageSprintR", "wizardL", "wizardR", "red_brick", "snow", "brown_brick", "crate", "gold1", "gem1", "magma", "water", "bone"];
  for (const name of imageFiles) images[name] = loadImage(`assets/${name}.png`);
  for (let i = 1; i <= MAP_COUNT; i++) mapLines[i] = loadStrings(`assets/map${i}.csv`);
  soundFormats("mp3");
  sounds.coin = loadSound("assets/coin-sound.mp3");
  sounds.jump = loadSound("assets/jump-sound.mp3");
}

function setup() {
  const canvas = createCanvas(GAME_WIDTH, GAME_HEIGHT);
  canvas.parent("game-shell");
  pixelDensity(1);
  imageMode(CORNER);
  textFont("system-ui");
  mage = new Mage(250, 400);
  loadLevel(1);
}

function draw() {
  background(20, 23, 45);
  resetGameIfRequested();
  if (state === GameState.START) drawIntroScreen();
  else if (state === GameState.LOADING) drawLevelScreen();
  else if (state === GameState.PLAYING) drawPlaying();
  else if (state === GameState.VICTORY) drawVictoryScreen();
  else drawLoseScreen();
}

function drawPlaying() {
  background(100, 200, 255);
  push();
  translate(-viewX, -viewY);
  world.drawTiles();
  const nearby = world.getNearByTiles(mage);
  mage.setVelocity();
  mage.handleHorizontalMovement(nearby);
  mage.applyGravity(nearby);
  for (const enemy of enemies) {
    if (!enemy.isAlive()) continue;
    const enemyNearby = world.getNearByTiles(enemy);
    enemy.setVelocity();
    enemy.handleHorizontalMovement(enemyNearby);
    enemy.applyGravity(enemyNearby);
    enemy.tryShootAt(mage);
  }
  updateProjectiles();
  updateWaterProjectiles();
  resolveProjectileHits();
  mage.display();
  enemies.forEach(enemy => enemy.display());
  checkCollectibleCollisions(mage);
  collectibles.forEach(item => item.display());
  if (resetMageRequested) resetMage();
  updateCamera();
  pop();
  drawScore();
}

function getRank() {
  if (coinScore >= 80) return "S";
  if (coinScore >= 65) return "A";
  if (coinScore >= 40) return "B";
  if (coinScore >= 20) return "C";
  return "D";
}

function getDifficultyName() {
  return selectedDifficulty === Difficulty.EASY ? "Easy" : selectedDifficulty === Difficulty.HARD ? "Hard" : "Normal";
}

function getEnemyCount() {
  return selectedDifficulty === Difficulty.EASY ? 1 : selectedDifficulty === Difficulty.HARD ? 3 : 2;
}

function getBoneValue() {
  return selectedDifficulty === Difficulty.HARD ? 10 : selectedDifficulty === Difficulty.NORMAL ? 7 : 5;
}

function drawScore() {
  push();
  noStroke();
  fill(0, 0, 0, 135);
  rect(12, 12, 210, 110, 12);
  fill(255);
  textAlign(LEFT, TOP);
  textSize(24);
  text(`Score: ${coinScore}\nRank: ${getRank()}\nDifficulty: ${getDifficultyName()}`, 24, 22);
  mage.drawCooldownTime();
  pop();
}

function updateCamera() {
  const targetX = constrain(mage.x - width / 2, 0, max(0, worldWidth - width));
  const targetY = constrain(mage.y - height / 2, 0, max(0, worldHeight - height));
  viewX += .2 * (targetX - viewX);
  viewY += .2 * (targetY - viewY);
}

function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const shot = projectiles[i];
    shot.update();
    if (shot.hitsWall() || shot.isOffWorld()) { projectiles.splice(i, 1); continue; }
    shot.display();
    if (!mage.isSprinting() && shot.collidesWith(mage)) {
      projectiles.splice(i, 1);
      coinScore -= 10;
      state = coinScore < 0 ? GameState.LOSE : state;
      resetMageRequested = true;
    }
  }
}

function updateWaterProjectiles() {
  for (let i = waterProjectiles.length - 1; i >= 0; i--) {
    const shot = waterProjectiles[i];
    shot.update();
    if (shot.hitsWall() || shot.isOffWorld()) waterProjectiles.splice(i, 1);
    else shot.display();
  }
}

function resolveProjectileHits() {
  for (let i = waterProjectiles.length - 1; i >= 0; i--) {
    const water = waterProjectiles[i];
    const enemy = enemies.find(item => item.isAlive() && water.collidesWith(item));
    if (enemy) {
      enemy.takeDamage(1);
      waterProjectiles.splice(i, 1);
      continue;
    }
    const magmaIndex = projectiles.findIndex(item => water.collidesWith(item));
    if (magmaIndex !== -1) {
      waterProjectiles.splice(i, 1);
      projectiles.splice(magmaIndex, 1);
    }
  }
}

function checkCollectibleCollisions(character) {
  for (let i = collectibles.length - 1; i >= 0; i--) {
    const item = collectibles[i];
    if (!item.collidesWith(character)) continue;
    if (item.type === "coin" || item.type === "bone") {
      collectibles.splice(i, 1);
      coinScore += item.type === "coin" ? 1 : item.scoreValue;
      playSound(sounds.coin);
    } else if (item.type === "gem") {
      collectibles.splice(i, 1);
      mapNumber++;
      if (mapNumber > MAP_COUNT) state = GameState.VICTORY;
      else {
        state = GameState.LOADING;
        timerStart = millis();
        loadLevel(mapNumber);
      }
      break;
    } else {
      coinScore -= 10;
      if (coinScore < 0) state = GameState.LOSE;
      resetMageRequested = true;
    }
  }
}

function playSound(sound) {
  if (sound && sound.isLoaded() && getAudioContext().state === "running") sound.play();
}

function menuBackdrop() {
  background(22, 25, 52);
  noStroke();
  for (let i = 0; i < 30; i++) {
    fill(115, 104, 220, 35 + (i % 4) * 20);
    circle((i * 181 + frameCount * .15) % width, (i * 97) % height, 12 + (i % 5) * 10);
  }
  textAlign(CENTER, CENTER);
}

function drawIntroScreen() {
  menuBackdrop();
  fill(255, 224, 105);
  textStyle(BOLD);
  textSize(92);
  text("SPRITEQUEST", width / 2, 230);
  fill(215, 212, 240);
  textStyle(NORMAL);
  textSize(28);
  text("Arrow keys move · X shoots · Z sprints · R returns to menu", width / 2, 355);
  text("Choose difficulty: 1 Easy · 2 Normal · 3 Hard", width / 2, 410);
  fill(146, 224, 255);
  textSize(32);
  text(`Selected: ${getDifficultyName()}`, width / 2, 472);
  fill(255);
  textSize(48);
  text("Press SPACE to play", width / 2, 575);
  timerStart = millis();
  if (resetMageRequested) startNewGame();
}

function drawLevelScreen() {
  menuBackdrop();
  const percent = constrain((millis() - timerStart) / waitTime, 0, 1);
  fill(255);
  textSize(58);
  text(`Level ${mapNumber}`, width / 2, 300);
  noFill(); stroke(255); strokeWeight(3);
  rect(width / 2 - 300, 420, 600, 24, 12);
  noStroke(); fill(104, 209, 255);
  rect(width / 2 - 300, 420, 600 * percent, 24, 12);
  fill(255); textSize(28);
  text(`${floor(percent * 100)}%`, width / 2, 490);
  if (percent >= 1) state = GameState.PLAYING;
}

function endScreen(title, subtitle) {
  menuBackdrop();
  fill(255, 224, 105); textStyle(BOLD); textSize(80); text(title, width / 2, 260);
  fill(215, 212, 240); textStyle(NORMAL); textSize(30); text(subtitle, width / 2, 380);
  text(`Difficulty: ${getDifficultyName()} — press 1, 2, or 3 to change`, width / 2, 440);
  fill(255); textSize(46); text("Press SPACE to play again", width / 2, 555);
  if (resetMageRequested) startNewGame();
}

function drawVictoryScreen() { endScreen("You win!", `You earned ${coinScore} coins`); }
function drawLoseScreen() { endScreen("You lose!", "You lost all your coins"); }

function startNewGame() {
  mapNumber = 1;
  coinScore = 0;
  timerStart = millis();
  state = GameState.LOADING;
  loadLevel(mapNumber);
  resetMageRequested = false;
}

function loadLevel(number) {
  collectibles = [];
  projectiles = [];
  waterProjectiles = [];
  enemies = [];
  const lines = mapLines[number];
  rows = lines.length;
  cols = lines[0].split(",").length;
  worldWidth = cols * TILE_SIZE;
  worldHeight = rows * TILE_SIZE;
  world = new World(lines);
  enemies = createEnemiesForMap();
  viewX = viewY = 0;
  resetMage();
}

function resetMage() {
  mage.x = 250; mage.y = 400; mage.xVelocity = 0; mage.yVelocity = 0;
  mage.resetSprintState();
  projectiles = []; waterProjectiles = [];
  if (selectedDifficulty !== Difficulty.EASY) resetEnemies();
  resetMageRequested = false;
}

function createEnemiesForMap() {
  const result = [], offsets = [0, 250, -250, 500, -500];
  const spawnX = world.getEnemySpawnX();
  for (let i = 0; i < min(getEnemyCount(), offsets.length); i++) {
    const x = constrain(spawnX + offsets[i], 0, max(0, worldWidth - SPRITE_WIDTH));
    result.push(new Enemy(x, world.findGroundY(x), getBoneValue()));
  }
  return result;
}

function resetEnemies() {
  const offsets = [0, 250, -250, 500, -500], spawnX = world.getEnemySpawnX();
  enemies.forEach((enemy, i) => {
    enemy.x = constrain(spawnX + offsets[i], 0, max(0, worldWidth - SPRITE_WIDTH));
    enemy.y = world.findGroundY(enemy.x);
    enemy.resetState();
  });
}

function resetGameIfRequested() {
  if (!resetGameRequested) return;
  state = GameState.START;
  resetGameRequested = false;
  resetMageRequested = false;
}

function keyPressed(event) {
  userStartAudio();
  if ([LEFT_ARROW, RIGHT_ARROW, UP_ARROW, 32].includes(keyCode)) event?.preventDefault();
  if (keyCode === LEFT_ARROW) leftPressed = true;
  else if (keyCode === RIGHT_ARROW) rightPressed = true;
  else if (keyCode === UP_ARROW) jumpPressed = true;
  else if (key === "z" || key === "Z") mage.triggerSprint();
  else if (key === "r" || key === "R") resetGameRequested = true;
  else if (key === "1" && ![GameState.PLAYING, GameState.LOADING].includes(state)) selectedDifficulty = Difficulty.EASY;
  else if (key === "2" && ![GameState.PLAYING, GameState.LOADING].includes(state)) selectedDifficulty = Difficulty.NORMAL;
  else if (key === "3" && ![GameState.PLAYING, GameState.LOADING].includes(state)) selectedDifficulty = Difficulty.HARD;
  else if (key === "x" || key === "X") mage.shootWater();
  else if (keyCode === 32) resetMageRequested = true;
  return false;
}

function keyReleased() {
  if (keyCode === LEFT_ARROW) leftPressed = false;
  else if (keyCode === RIGHT_ARROW) rightPressed = false;
  else if (keyCode === UP_ARROW) jumpPressed = false;
  return false;
}

class Character {
  constructor(x, y) {
    this.x = x; this.y = y; this.xVelocity = 0; this.yVelocity = 0;
    this.gravity = .5; this.onGround = false; this.spriteWidth = 50; this.spriteHeight = 50;
  }
  applyGravity(nearby) {
    this.onGround = false;
    this.yVelocity += this.gravity;
    let nextY = this.y + this.yVelocity;
    for (const p of nearby) {
      const overlapX = this.x + this.spriteWidth > p.x && this.x < p.x + p.size;
      if (this.yVelocity > 0 && overlapX && this.y + this.spriteHeight <= p.y && nextY + this.spriteHeight >= p.y) {
        nextY = p.y - this.spriteHeight; this.yVelocity = 0; this.onGround = true;
      }
      if (this.yVelocity < 0 && overlapX && this.y >= p.y + p.size && nextY <= p.y + p.size) {
        nextY = p.y + p.size; this.yVelocity = 0;
      }
    }
    this.y = nextY;
    const bottom = rows * TILE_SIZE - this.spriteHeight;
    if (this.y > bottom) { this.y = bottom; this.yVelocity = 0; this.onGround = true; }
    if (this.y < 0) { this.y = 0; this.yVelocity = max(0, this.yVelocity); }
  }
  jump() {
    if (this.onGround) { this.yVelocity = -13; playSound(sounds.jump); }
  }
  handleHorizontalMovement(nearby) {
    this.x = constrain(this.x, 0, cols * TILE_SIZE);
    this.x += this.xVelocity;
    for (const p of nearby) {
      const overlap = this.x < p.x + p.size && this.x + this.spriteWidth > p.x && this.y < p.y + p.size && this.y + this.spriteHeight > p.y;
      if (!overlap) continue;
      if (this.xVelocity > 0) this.x = p.x - this.spriteWidth;
      else if (this.xVelocity < 0) this.x = p.x + p.size;
      this.xVelocity = 0;
    }
    this.x = constrain(this.x, 0, cols * TILE_SIZE - SPRITE_WIDTH);
  }
}

class Mage extends Character {
  constructor(x, y) {
    super(x, y);
    this.facingRight = true;
    this.shootCooldownFrames = 18; this.lastShotFrame = -18;
    this.sprintCooldownFrames = 90; this.sprintDurationFrames = 10;
    this.lastSprintFrame = -90; this.sprintStartFrame = -10; this.sprintSpeed = 16;
  }
  setVelocity() {
    if (this.isSprinting()) { this.xVelocity = this.facingRight ? this.sprintSpeed : -this.sprintSpeed; return; }
    this.xVelocity = 0;
    if (leftPressed) { this.xVelocity -= 7; this.facingRight = false; }
    if (rightPressed) { this.xVelocity += 7; this.facingRight = true; }
    if (jumpPressed) this.jump();
  }
  display() {
    const sprite = this.isSprinting()
      ? images[this.facingRight ? "mageSprintR" : "mageSprintL"]
      : images[this.facingRight ? "mageR" : "mageL"];
    const offset = this.onGround && !this.isSprinting() ? sin(frameCount * .1) * 5 : 0;
    image(sprite, this.x, this.y + offset, 50, 50);
  }
  isSprinting() { return frameCount - this.sprintStartFrame < this.sprintDurationFrames; }
  triggerSprint() {
    if (this.isSprinting() || frameCount - this.lastSprintFrame < this.sprintCooldownFrames) return;
    if (leftPressed) this.facingRight = false;
    else if (rightPressed) this.facingRight = true;
    this.sprintStartFrame = this.lastSprintFrame = frameCount;
  }
  resetSprintState() { this.sprintStartFrame = -this.sprintDurationFrames; this.lastSprintFrame = -this.sprintCooldownFrames; }
  shootWater() {
    if (state !== GameState.PLAYING || frameCount - this.lastShotFrame < this.shootCooldownFrames) return;
    const direction = this.facingRight ? 1 : -1;
    waterProjectiles.push(new WaterProjectile(direction > 0 ? this.x + 50 : this.x - 20, this.y + 20, direction * 10));
    this.lastShotFrame = frameCount;
  }
  drawCooldownTime() {
    const items = [
      { x: width - 110, label: "X", name: "shot", color: [40, 120, 255], percent: constrain((frameCount - this.lastShotFrame) / this.shootCooldownFrames, 0, 1) },
      { x: width - 50, label: "Z", name: "sprint", color: [255, 150, 40], percent: constrain((frameCount - this.lastSprintFrame) / this.sprintCooldownFrames, 0, 1) }
    ];
    for (const item of items) {
      stroke(210); strokeWeight(3); fill(235); circle(item.x, height - 50, 42);
      stroke(...item.color); noFill(); arc(item.x, height - 50, 42, 42, -HALF_PI, -HALF_PI + TWO_PI * item.percent);
      noStroke(); fill(...item.color); textAlign(CENTER, CENTER); textSize(12); text(item.label, item.x, height - 50);
      fill(255); textSize(10); text(item.name, item.x, height - 18);
    }
  }
}

class Enemy extends Character {
  constructor(x, y, boneValue) {
    super(x, y);
    this.enemyfacingRight = true; this.direction = 1; this.patrolSpeed = 3;
    this.turnAroundSpeed = 3000 / getEnemyCount() / getEnemyCount();
    this.waitTurnAround = 0; this.waitingToTurn = false;
    this.shootCooldownFrames = 100; this.lastShotFrame = -100;
    this.maxHealth = 5; this.health = 5; this.droppedBone = null; this.boneValue = boneValue;
  }
  isAlive() { return this.health > 0; }
  setVelocity() {
    if (!this.isAlive()) { this.xVelocity = 0; return; }
    if (this.waitingToTurn) {
      this.xVelocity = 0;
      if (millis() - this.waitTurnAround >= this.turnAroundSpeed) { this.direction *= -1; this.waitingToTurn = false; }
      this.enemyfacingRight = this.direction > 0; return;
    }
    if (this.shouldTurnAround()) { this.waitTurnAround = millis(); this.waitingToTurn = true; this.xVelocity = 0; return; }
    this.xVelocity = this.patrolSpeed * this.direction;
    this.enemyfacingRight = this.direction > 0;
  }
  shouldTurnAround() {
    const frontX = this.direction > 0 ? this.x + 52 : this.x - 2;
    if (world.isSolidAt(frontX, this.y + 6) || world.isSolidAt(frontX, this.y + 44)) return true;
    if (this.onGround) {
      const groundX = this.direction > 0 ? this.x + 54 : this.x - 4;
      if (!world.isSolidAt(groundX, this.y + 54)) return true;
    }
    return false;
  }
  tryShootAt(target) {
    if (!this.isAlive() || frameCount - this.lastShotFrame < this.shootCooldownFrames) return;
    if (abs((target.y + 25) - (this.y + 25)) > 200) return;
    const direction = target.x >= this.x ? 1 : -1;
    projectiles.push(new Projectile(direction > 0 ? this.x + 50 : this.x - 24, this.y + 17.5, direction * 7));
    this.enemyfacingRight = direction > 0; this.lastShotFrame = frameCount;
  }
  takeDamage(amount) { this.health = max(0, this.health - amount); if (this.health === 0) this.dropBone(); }
  dropBone() {
    this.droppedBone = new Collectible(this.x + 2.5, this.y + 5, images.bone, 45, "bone", this.boneValue);
    collectibles.push(this.droppedBone);
  }
  resetState() {
    if (this.droppedBone) collectibles = collectibles.filter(item => item !== this.droppedBone);
    this.health = this.maxHealth; this.xVelocity = this.yVelocity = 0; this.direction = 1;
    this.enemyfacingRight = true; this.waitTurnAround = 0; this.waitingToTurn = false;
    this.lastShotFrame = -this.shootCooldownFrames; this.droppedBone = null;
  }
  display() {
    if (!this.isAlive()) return;
    image(images[this.enemyfacingRight ? "wizardR" : "wizardL"], this.x, this.y + (this.onGround ? sin(frameCount * .1) * 5 : 0), 50, 50);
    noStroke(); fill(60); rect(this.x, this.y - 14, 50, 8);
    fill(70, 220, 90); rect(this.x, this.y - 14, 50 * this.health / this.maxHealth, 8);
  }
}

class Platform {
  constructor(x, y, img, size) { this.x = x; this.y = y; this.img = img; this.size = size; }
  display() { image(this.img, this.x, this.y, this.size, this.size); }
}

class Collectible {
  constructor(x, y, img, size, type, scoreValue = 0) { Object.assign(this, { x, y, img, size, type, scoreValue }); }
  display() { image(this.img, this.x, this.y, this.size, this.size); }
  collidesWith(c) { return c.x + c.spriteWidth > this.x && c.x < this.x + this.size && c.y + c.spriteHeight > this.y && c.y < this.y + this.size; }
}

class Projectile {
  static SIZE = 24;
  constructor(x, y, xVelocity) { Object.assign(this, { x, y, xVelocity }); }
  update() { this.x += this.xVelocity; }
  display() { image(images.magma, this.x, this.y, Projectile.SIZE, Projectile.SIZE); }
  hitsWall() { return world.isSolidAt(this.xVelocity > 0 ? this.x + Projectile.SIZE : this.x, this.y + Projectile.SIZE / 2); }
  isOffWorld() { return this.x + Projectile.SIZE < 0 || this.x > worldWidth || this.y + Projectile.SIZE < 0 || this.y > worldHeight; }
  collidesWith(c) { return this.x + Projectile.SIZE > c.x && this.x < c.x + c.spriteWidth && this.y + Projectile.SIZE > c.y && this.y < c.y + c.spriteHeight; }
}

class WaterProjectile {
  static SIZE = 20;
  constructor(x, y, xVelocity) { Object.assign(this, { x, y, xVelocity }); }
  update() { this.x += this.xVelocity; }
  display() { image(images.water, this.x, this.y, WaterProjectile.SIZE, WaterProjectile.SIZE); }
  hitsWall() { return world.isSolidAt(this.xVelocity > 0 ? this.x + WaterProjectile.SIZE : this.x, this.y + WaterProjectile.SIZE / 2); }
  isOffWorld() { return this.x + WaterProjectile.SIZE < 0 || this.x > worldWidth || this.y + WaterProjectile.SIZE < 0 || this.y > worldHeight; }
  collidesWith(target) {
    const size = target instanceof Projectile ? Projectile.SIZE : target.spriteWidth;
    const height = target instanceof Projectile ? Projectile.SIZE : target.spriteHeight;
    return this.x + WaterProjectile.SIZE > target.x && this.x < target.x + size && this.y + WaterProjectile.SIZE > target.y && this.y < target.y + height;
  }
}

class World {
  constructor(lines) {
    this.lines = lines; this.rows = lines.length; this.cols = lines[0].split(",").length;
    this.tileGrid = Array.from({ length: this.cols }, () => Array(this.rows).fill(null));
    this.enemySpawnX = 600; this.hasEnemySpawn = false;
    this.createPlatforms();
  }
  createPlatforms() {
    const tileImages = { "1": images.red_brick, "2": images.snow, "3": images.brown_brick, "4": images.crate, "8": images.water };
    const collectiblesByCode = { "5": [images.gold1, "coin"], "6": [images.gem1, "gem"], "7": [images.magma, "magma"] };
    this.lines.forEach((line, row) => line.split(",").forEach((raw, col) => {
      const value = raw.trim();
      if (tileImages[value]) this.tileGrid[col][row] = new Platform(col * TILE_SIZE, row * TILE_SIZE, tileImages[value], TILE_SIZE);
      else if (collectiblesByCode[value]) {
        const [img, type] = collectiblesByCode[value];
        collectibles.push(new Collectible(col * TILE_SIZE, row * TILE_SIZE, img, TILE_SIZE, type));
      } else if (value === "9") { this.enemySpawnX = col * TILE_SIZE; this.hasEnemySpawn = true; }
    }));
  }
  drawTiles() { for (const column of this.tileGrid) for (const tile of column) if (tile) tile.display(); }
  getNearByTiles(c) {
    const result = [];
    const left = max(0, floor(c.x / TILE_SIZE) - 1), right = min(this.cols - 1, floor((c.x + c.spriteWidth) / TILE_SIZE) + 1);
    const top = max(0, floor(c.y / TILE_SIZE) - 1), bottom = min(this.rows - 1, floor((c.y + c.spriteHeight) / TILE_SIZE) + 1);
    for (let col = left; col <= right; col++) for (let row = top; row <= bottom; row++) if (this.tileGrid[col][row]) result.push(this.tileGrid[col][row]);
    return result;
  }
  isSolidAt(x, y) {
    const col = floor(x / TILE_SIZE), row = floor(y / TILE_SIZE);
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows && this.tileGrid[col][row] !== null;
  }
  findGroundY(x) {
    const col = constrain(floor((x + SPRITE_WIDTH / 2) / TILE_SIZE), 0, this.cols - 1);
    for (let row = 0; row < this.rows; row++) if (this.tileGrid[col][row]) return this.tileGrid[col][row].y - SPRITE_HEIGHT;
    return this.rows * TILE_SIZE - SPRITE_HEIGHT;
  }
  getEnemySpawnX() { return this.hasEnemySpawn ? this.enemySpawnX : 600; }
}
