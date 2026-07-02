/* ============================================================
   词域探险 - Word Realm Roguelike  (Web Port)
   Ported from C# WordRogue.cs → HTML5 Canvas + JavaScript
   ============================================================ */
'use strict';

// ── Constants ────────────────────────────────────────────────
const W = 1280, H = 720, DT = 1/60;

// ── Enums ────────────────────────────────────────────────────
const GameState = { Menu:0, Playing:1, RoomClear:2, RewardChoice:3, GameOver:4, Win:5, Paused:6 };
const MonsterKind = { Wanderer:0, Chaser:1, Dasher:2, Shield:3, Ghost:4 };
const DropKind = { Apple:0, Coffee:1, ShieldPotion:2, Ink:3, Boots:4, Feather:5, Gloves:6 };
const RewardKind = { Survival:0, MoveSpeed:1, Shield:2, ChestSpeed:3, ChestThrow:4, ChestEcho:5 };

// ── Vec2 ─────────────────────────────────────────────────────
class Vec2 {
  constructor(x,y){this.x=x||0;this.y=y||0}
  len(){return Math.sqrt(this.x*this.x+this.y*this.y)}
  norm(){const l=this.len();return l<0.001?new Vec2(0,0):new Vec2(this.x/l,this.y/l)}
  add(v){return new Vec2(this.x+v.x,this.y+v.y)}
  sub(v){return new Vec2(this.x-v.x,this.y-v.y)}
  mul(s){return new Vec2(this.x*s,this.y*s)}
  distTo(v){return this.sub(v).len()}
  clone(){return new Vec2(this.x,this.y)}
}

// ── Data classes ─────────────────────────────────────────────
class WordEntry {
  constructor(w,meaning,diff,freq,tags){
    this.word=w||'';this.meaning=meaning||'';this.difficulty=diff||0;
    this.frequencyRank=freq||0;this.tags=tags||[];
    this.seenCount=0;this.correctCount=0;this.wrongCount=0;
    this.deathCount=0;this.mastery=0;this.lastSeenRoom=0;
  }
}
class SaveData {
  constructor(){
    this.words=[];this.bestRoom=0;this.totalCorrect=0;this.totalWrong=0;
    this.hasContinue=false;this.continueMode=0;this.continueModeName='';
    this.continueRoom=0;this.continueHp=0;this.continueSpeed=0;
    this.continueDashCooldown=0;this.continueThrowSpeed=0;
    this.continuePickupRange=0;this.continueDefense=0;this.continueLuck=0;
    this.continuePiercingInkRooms=0;this.continueEchoScrollRooms=0;
    this.continueSpeedBoostRooms=0;this.continueThrowBoostRooms=0;
    this.continueDashBoostRooms=0;this.continuePickupBoostRooms=0;
    this.continueTempSpeedBonus=0;this.continueTempThrowBonus=0;
    this.continueTempDashBonus=0;this.continueTempPickupBonus=0;
  }
}
class Player {
  constructor(){
    this.pos=new Vec2(W/2,H/2+120);this.radius=18;this.hp=100;this.maxHp=100;
    this.speed=245;this.dashCooldown=1.2;this.dashTimer=0;this.throwSpeed=610;
    this.pickupRange=84;this.defense=0;this.memoryBonus=0;this.luck=0;
    this.invulnerable=0;this.speedBoost=0;this.shieldTime=0;
    this.piercingInk=false;this.echoScroll=false;this.heldMeaning='';
  }
}
class Monster {
  constructor(entry){
    this.entry=entry;this.pos=new Vec2();this.vel=new Vec2();
    this.radius=31+entry.difficulty*1.8;this.hp=1;this.maxHp=1;
    this.kind=MonsterKind.Wanderer;this.thinkTimer=0;this.rageTimer=0;
    this.dashWindup=0;this.shootTimer=0;this.facingRight=true;
    this.shieldUp=false;this.fromMistake=false;
  }
}
class MeaningToken {
  constructor(meaning,pos,correct){
    this.meaning=meaning;this.pos=pos;this.correctForRoom=correct;this.glowTimer=0;
  }
}
class Projectile {
  constructor(meaning,pos,vel){
    this.meaning=meaning;this.pos=pos;this.vel=vel;this.life=1.55;
    this.piercing=false;this.universal=false;this.returnOnMiss=true;
    this.hit=new Set();
  }
}
class EnemyProjectile {
  constructor(pos,vel){
    this.pos=pos;this.vel=vel;this.life=3.2;this.damage=9;
  }
}
class Drop {
  constructor(kind,pos){this.kind=kind;this.pos=pos;this.life=16;}
}
class RewardCard {
  constructor(kind,cat,title,desc,value){
    this.kind=kind;this.category=cat;this.title=title;
    this.description=desc;this.value=value;
  }
}
class Chest { constructor(pos){this.pos=pos;this.opened=false;} }
class Obstacle {
  constructor(){this.bounds={x:0,y:0,w:0,h:0};this.kind='';this.spriteIndex=0;
    this.fill='';this.stroke='';}
}
class FloatingText {
  constructor(text,pos,color){this.text=text;this.pos=pos;this.life=1.35;this.color=color;}
}

// ── Theme ────────────────────────────────────────────────────
const THEMES = [
  {name:'新手森林',floor:'rgb(33,62,45)',wall:'rgb(19,36,31)',accent:'rgb(118,184,98)'},
  {name:'办公废墟',floor:'rgb(58,61,66)',wall:'rgb(32,34,39)',accent:'rgb(224,175,92)'},
  {name:'校园图书馆',floor:'rgb(58,48,75)',wall:'rgb(33,28,48)',accent:'rgb(154,133,201)'},
  {name:'科技实验室',floor:'rgb(35,63,73)',wall:'rgb(20,37,44)',accent:'rgb(74,189,198)'},
  {name:'商业矿井',floor:'rgb(72,58,42)',wall:'rgb(40,32,27)',accent:'rgb(227,188,93)'},
  {name:'学术神殿',floor:'rgb(51,53,75)',wall:'rgb(28,31,48)',accent:'rgb(220,219,166)'},
  {name:'旅行港口',floor:'rgb(35,73,86)',wall:'rgb(22,43,54)',accent:'rgb(106,177,221)'},
  {name:'情绪洞穴',floor:'rgb(74,45,58)',wall:'rgb(42,27,36)',accent:'rgb(228,122,139)'}
];
const BG_NAMES = ['forest.jpg','office.jpg','library.jpg','lab.jpg','business_mine.jpg','academic_temple.jpg','travel_port.jpg','emotion_cave.jpg'];

// ── Drop display names ───────────────────────────────────────
const DROP_NAMES = ['苹果','咖啡','护盾','穿透墨水','风之靴','轻羽','磁力手套'];
const MONSTER_COLORS = ['#d6535c','#e8754f','#ecb949','#698edc','#ae6fd6'];
const MONSTER_SPRITES = [1,2,3,4,5,6]; // index into characters_monsters

// =============================================================
//  GAME CLASS
// =============================================================
class Game {
  constructor(canvas){
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.rng = Math.random;

    // Game state
    this.state = GameState.Menu;
    this.prevState = GameState.Menu;
    this.selectedMode = 1;
    this.selectedModeName = '小学 / PEP词汇';
    this.message = '选择难度后开始探险';
    this.showBook = false;

    // Entity lists
    this.player = new Player();
    this.monsters = [];
    this.meanings = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.drops = [];
    this.rewardCards = [];
    this.floatingTexts = [];
    this.chests = [];
    this.obstacles = [];
    this.runWords = [];

    // Word bank
    this.allWords = [];
    this.bankWords = [];
    this.saveData = new SaveData();

    // Room state
    this.room = 0;
    this.combo = 0;
    this.streakWrong = 0;
    this.correctHits = 0;
    this.wrongHits = 0;
    this.collisions = 0;
    this.roomTime = 0;
    this.clearDelay = 0;
    this.roomDifficultyScale = 1;
    this.endScrollOffset = 0;

    // Temp powerups
    this.speedBoostRooms=0;this.throwBoostRooms=0;this.dashBoostRooms=0;
    this.pickupBoostRooms=0;this.piercingInkRooms=0;this.echoScrollRooms=0;
    this.tempSpeedBonus=0;this.tempThrowBonus=0;this.tempDashBonus=0;
    this.tempPickupBonus=0;

    // Animation
    this.walkAnimTime=0;this.dashAnimTime=0;this.fireAnimTime=0;
    this.playerFacing=0;this.lastMoveDir=new Vec2(0,1);

    // Input
    this.keys = new Set();
    this.mouse = new Vec2(W/2, H/2);
    this.mouseLeftDown = false;
    this.isMobile = false;

    // Touch
    this.touchJoyActive = false;
    this.touchJoyOrigin = new Vec2();
    this.touchJoyDir = new Vec2();

    // Assets
    this.images = {};
    this.sounds = {};
    this.assetLoadCount = 0;
    this.assetTotal = 0;
    this.ready = false;

    // Obstacle sprite data
    this.obstacleSpriteSources = [];
    this.obstacleSpriteVisible = [];

    // Render scaling
    this.renderScale = 1;
    this.renderOffsetX = 0;
    this.renderOffsetY = 0;

    this.init();
  }

  // ── Init ────────────────────────────────────────────────────
  async init(){
    this.detectMobile();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    await this.loadAssets();
    this.loadSave();
    await this.loadWords();
    this.mergeSavedStats();
    this.setupInput();
    this.ready = true;
    this.loop();
  }

  detectMobile(){
    this.isMobile = /Android|iPad|iPhone|iPod|webOS/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1);
    if(this.isMobile){
      document.getElementById('touch-layer').style.display = 'block';
    }
  }

  resizeCanvas(){
    const dpr = window.devicePixelRatio || 1;
    this.cv.width = window.innerWidth * dpr;
    this.cv.height = window.innerHeight * dpr;
    this.updateRenderViewport();
  }

  updateRenderViewport(){
    const sx = this.cv.width / W;
    const sy = this.cv.height / H;
    this.renderScale = Math.max(0.1, Math.min(sx, sy));
    this.renderOffsetX = (this.cv.width - W * this.renderScale) / 2;
    this.renderOffsetY = (this.cv.height - H * this.renderScale) / 2;
  }

  clientToGame(px, py){
    const dpr = window.devicePixelRatio || 1;
    const x = (px * dpr - this.renderOffsetX) / this.renderScale;
    const y = (py * dpr - this.renderOffsetY) / this.renderScale;
    return new Vec2(clamp(x,0,W), clamp(y,0,H));
  }

  // ── Asset loading ───────────────────────────────────────────
  async loadAssets(){
    const names = {
      heroGunActions: 'assets/runtime/hero_gun_actions.png',
      heroWalk: 'assets/runtime/hero_walk.png',
      heroDirections: 'assets/runtime/hero_directions.png',
      weaponAmmo: 'assets/runtime/weapon_ammo.png',
      characters: 'assets/runtime/characters_monsters.png',
      obstacles: 'assets/runtime/theme_obstacles.png',
      items: 'assets/runtime/items_projectiles_chests.png',
      tiles: 'assets/runtime/theme_tiles_walls.png',
    };
    this.assetTotal = Object.keys(names).length + BG_NAMES.length;
    const promises = [];
    for(const [key, path] of Object.entries(names)){
      promises.push(this.loadImage(key, path));
    }
    for(let i=0; i<BG_NAMES.length; i++){
      promises.push(this.loadImage('bg_'+i, 'assets/runtime/backgrounds/'+BG_NAMES[i]));
    }
    await Promise.all(promises);
    this.buildObstacleSpriteSources();
    // Load sounds
    this.loadSound('ui_click', 'assets/runtime/sounds/ui_click.mp3');
    this.loadSound('hit_correct', 'assets/runtime/sounds/hit_correct.mp3');
  }

  loadImage(key, src){
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => { this.images[key] = img; this.assetLoadCount++; resolve(); };
      img.onerror = () => { this.assetLoadCount++; resolve(); };
      img.src = src;
    });
  }

  loadSound(key, src){
    try {
      this.sounds[key] = new Audio(src);
      this.sounds[key].preload = 'auto';
    } catch(e){}
  }

  playSound(key){
    try {
      const s = this.sounds[key];
      if(!s) return;
      s.currentTime = 0;
      s.play().catch(()=>{});
    } catch(e){}
  }

  buildObstacleSpriteSources(){
    const img = this.images.obstacles;
    if(!img) return;
    for(let i=0; i<8; i++){
      const cell = this.atlasCell(img.width, img.height, 4, 2, i);
      this.obstacleSpriteSources.push(cell);
      this.obstacleSpriteVisible.push(true);
    }
  }

  // ── Atlas helpers ───────────────────────────────────────────
  atlasCell(imgW, imgH, cols, rows, index){
    const cw = Math.floor(imgW / cols);
    const ch = Math.floor(imgH / rows);
    return { x: (index % cols) * cw, y: Math.floor(index / cols) * ch, w: cw, h: ch };
  }

  drawAtlas(ctx, key, cols, rows, index, dx, dy, dw, dh, mirror){
    const img = this.images[key];
    if(!img) return;
    const src = this.atlasCell(img.width, img.height, cols, rows, index);
    ctx.save();
    if(mirror){
      ctx.translate(dx + dw/2, dy + dh/2);
      ctx.scale(-1, 1);
      ctx.drawImage(img, src.x, src.y, src.w, src.h, -dw/2, -dh/2, dw, dh);
    } else {
      ctx.drawImage(img, src.x, src.y, src.w, src.h, dx, dy, dw, dh);
    }
    ctx.restore();
  }

  drawAtlasCentered(ctx, key, cols, rows, index, cx, cy, w, h, mirror){
    this.drawAtlas(ctx, key, cols, rows, index, cx - w/2, cy - h/2, w, h, mirror);
  }

  drawRotatedAtlasCentered(ctx, key, cols, rows, index, cx, cy, w, h, degrees){
    const img = this.images[key];
    if(!img) return;
    const src = this.atlasCell(img.width, img.height, cols, rows, index);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(degrees * Math.PI / 180);
    ctx.drawImage(img, src.x, src.y, src.w, src.h, -w/2, -h/2, w, h);
    ctx.restore();
  }

  // ── Word bank loading ───────────────────────────────────────
  async loadWords(){
    try {
      const resp = await fetch('wordbank.json');
      const data = await resp.json();
      this.allWords = data.map(d => {
        const w = new WordEntry(d.word, d.meaning, d.difficulty, d.frequencyRank, d.tags || []);
        return w;
      });
    } catch(e){
      this.allWords = this.defaultWords();
    }
    if(this.allWords.length === 0) this.allWords = this.defaultWords();
  }

  defaultWords(){
    return [
      new WordEntry('increase','增加',2,1000,['verb','academic']),
      new WordEntry('decrease','减少',2,1000,['verb','academic']),
      new WordEntry('include','包含',2,1000,['verb','academic']),
      new WordEntry('improve','改善',2,1000,['verb','daily']),
      new WordEntry('affect','影响',3,1000,['verb','academic']),
      new WordEntry('market','市场',2,1000,['business','noun']),
      new WordEntry('research','研究',3,1000,['academic','noun']),
      new WordEntry('transport','运输',3,1000,['travel','noun']),
    ];
  }

  // ── Save/Load ───────────────────────────────────────────────
  loadSave(){
    try {
      const data = localStorage.getItem('vocabRogueSave');
      if(data){
        const parsed = JSON.parse(data);
        this.saveData = Object.assign(new SaveData(), parsed);
        return;
      }
    } catch(e){}
    this.saveData = new SaveData();
  }

  save(){
    try {
      this.saveData.words = this.allWords;
      localStorage.setItem('vocabRogueSave', JSON.stringify(this.saveData));
    } catch(e){}
  }

  mergeSavedStats(){
    const saved = new Map();
    for(const w of this.saveData.words) saved.set(w.word, w);
    for(const w of this.allWords){
      const s = saved.get(w.word);
      if(s){
        w.seenCount=s.seenCount||0;w.correctCount=s.correctCount||0;
        w.wrongCount=s.wrongCount||0;w.deathCount=s.deathCount||0;
        w.mastery=s.mastery||0;w.lastSeenRoom=s.lastSeenRoom||0;
      }
    }
  }

  // ── Input ───────────────────────────────────────────────────
  setupInput(){
    // Keyboard
    document.addEventListener('keydown', e => this.onKeyDown(e));
    document.addEventListener('keyup', e => this.onKeyUp(e));

    // Mouse (desktop)
    this.cv.addEventListener('mousemove', e => {
      this.mouse = this.clientToGame(e.clientX, e.clientY);
    });
    this.cv.addEventListener('mousedown', e => {
      if(e.button === 0) this.onMouseDown(e.clientX, e.clientY);
    });
    this.cv.addEventListener('mouseup', e => {
      if(e.button === 0) this.mouseLeftDown = false;
    });

    // Touch
    if(this.isMobile){
      this.setupTouch();
    }

    // UI buttons
    document.getElementById('btn-e').addEventListener('touchstart', e => {
      e.preventDefault(); this.tryInteract();
    }, {passive:false});
    document.getElementById('btn-q').addEventListener('touchstart', e => {
      e.preventDefault(); this.usePotion();
    }, {passive:false});
    document.getElementById('btn-pause').addEventListener('touchstart', e => {
      e.preventDefault(); this.togglePause();
    }, {passive:false});
    document.getElementById('btn-book').addEventListener('touchstart', e => {
      e.preventDefault(); this.showBook = !this.showBook;
    }, {passive:false});
  }

  setupTouch(){
    const zone = document.getElementById('joystick-zone');
    const base = document.getElementById('joy-base');
    const knob = document.getElementById('joy-knob');

    zone.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      this.touchJoyActive = true;
      this.touchJoyOrigin = new Vec2(t.clientX, t.clientY);
      base.style.display = 'block';
      knob.style.display = 'block';
      base.style.left = (t.clientX - 60) + 'px';
      base.style.top = (t.clientY - 60) + 'px';
      knob.style.left = t.clientX + 'px';
      knob.style.top = t.clientY + 'px';
    }, {passive:false});

    zone.addEventListener('touchmove', e => {
      e.preventDefault();
      if(!this.touchJoyActive) return;
      const t = e.touches[0];
      const dx = t.clientX - this.touchJoyOrigin.x;
      const dy = t.clientY - this.touchJoyOrigin.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const maxDist = 55;
      const clampedDist = Math.min(dist, maxDist);
      const angle = Math.atan2(dy, dx);
      const kx = this.touchJoyOrigin.x + Math.cos(angle) * clampedDist;
      const ky = this.touchJoyOrigin.y + Math.sin(angle) * clampedDist;
      knob.style.left = kx + 'px';
      knob.style.top = ky + 'px';
      if(dist > 8){
        this.touchJoyDir = new Vec2(dx/dist, dy/dist);
      } else {
        this.touchJoyDir = new Vec2(0,0);
      }
    }, {passive:false});

    const endJoy = e => {
      e.preventDefault();
      this.touchJoyActive = false;
      this.touchJoyDir = new Vec2(0,0);
      base.style.display = 'none';
      knob.style.display = 'none';
    };
    zone.addEventListener('touchend', endJoy, {passive:false});
    zone.addEventListener('touchcancel', endJoy, {passive:false});

    // Right side: touch-drag to aim, release to fire
    this.touchAimId = null; // track which touch is aiming

    this.cv.addEventListener('touchstart', e => {
      for(const t of e.changedTouches){
        if(t.clientX < window.innerWidth * 0.4) continue;
        const gp = this.clientToGame(t.clientX, t.clientY);
        if(this.state === GameState.Menu){
          this.handleMenuClick(gp);
        } else if(this.state === GameState.RewardChoice){
          this.handleRewardClick(gp);
        } else if(this.state === GameState.Playing){
          // Start aiming (don't fire yet)
          this.touchAimId = t.identifier;
          this.mouse = gp;
          this.updateFacingFromAim(true);
        } else if(this.state === GameState.GameOver || this.state === GameState.Win){
          this.state = GameState.Menu;
        }
      }
    }, {passive:true});

    this.cv.addEventListener('touchmove', e => {
      for(const t of e.changedTouches){
        if(t.clientX < window.innerWidth * 0.4) continue;
        this.mouse = this.clientToGame(t.clientX, t.clientY);
        if(this.touchAimId !== null && t.identifier === this.touchAimId){
          this.updateFacingFromAim(true);
        }
      }
    }, {passive:true});

    this.cv.addEventListener('touchend', e => {
      for(const t of e.changedTouches){
        if(t.identifier === this.touchAimId){
          // Release → fire
          this.mouse = this.clientToGame(t.clientX, t.clientY);
          if(this.state === GameState.Playing) this.fireHeldMeaning(false);
          this.touchAimId = null;
          break;
        }
      }
    }, {passive:true});

    this.cv.addEventListener('touchcancel', e => {
      for(const t of e.changedTouches){
        if(t.identifier === this.touchAimId){
          this.touchAimId = null; break;
        }
      }
    }, {passive:true});
  }

  onKeyDown(e){
    this.keys.add(e.code);
    if(e.code === 'F11'){
      e.preventDefault();
      if(!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
      else document.exitFullscreen().catch(()=>{});
      return;
    }
    if(this.state === GameState.Menu){
      if(e.code==='Digit1'||e.code==='Numpad1'){this.playSound('ui_click');this.selectDifficulty(1,'小学 / PEP词汇');}
      if(e.code==='Digit2'||e.code==='Numpad2'){this.playSound('ui_click');this.selectDifficulty(3,'初中 / 高中词汇');}
      if(e.code==='Digit3'||e.code==='Numpad3'){this.playSound('ui_click');this.selectDifficulty(5,'普通 / 四六级词汇');}
      if(e.code==='Digit4'||e.code==='Numpad4'){this.playSound('ui_click');this.selectDifficulty(7,'困难 / 雅思词汇');}
      if(e.code==='Enter'){this.playSound('ui_click');this.startSelectedGame();}
      return;
    }
    if(e.code === 'Escape'){
      this.togglePause();
      return;
    }
    if(this.state===GameState.GameOver||this.state===GameState.Win){
      if(e.code==='ArrowUp'){this.scrollEndList(-1);return;}
      if(e.code==='ArrowDown'){this.scrollEndList(1);return;}
      if(e.code==='PageUp'){this.scrollEndList(-8);return;}
      if(e.code==='PageDown'){this.scrollEndList(8);return;}
      if(e.code==='Enter') this.state=GameState.Menu;
      return;
    }
    if(this.state===GameState.RewardChoice){
      if(e.code==='Digit1'||e.code==='Numpad1') this.chooseReward(0);
      if(e.code==='Digit2'||e.code==='Numpad2') this.chooseReward(1);
      if(e.code==='Digit3'||e.code==='Numpad3') this.chooseReward(2);
      return;
    }
    if(this.state===GameState.Playing||this.state===GameState.RoomClear){
      if(e.code==='Tab') this.showBook=true;
      if(e.code==='Space') this.tryDash();
      if(e.code==='KeyE') this.tryInteract();
      if(e.code==='KeyQ') this.usePotion();
    }
  }

  onKeyUp(e){
    this.keys.delete(e.code);
    if(e.code==='Tab') this.showBook=false;
  }

  onMouseDown(cx, cy){
    const gp = this.clientToGame(cx, cy);
    if(this.state === GameState.Menu){ this.handleMenuClick(gp); return; }
    if(this.state === GameState.RewardChoice){ this.handleRewardClick(gp); return; }
    this.mouse = gp;
    this.mouseLeftDown = true;
    if(this.state === GameState.Playing) this.fireHeldMeaning(false);
  }

  togglePause(){
    if(this.state === GameState.Playing){
      this.prevState = this.state;
      this.state = GameState.Paused;
    } else if(this.state === GameState.Paused){
      this.state = this.prevState;
    }
  }

  // ── Menu ────────────────────────────────────────────────────
  menuDifficultyRect(index){
    const width=220, height=150, gap=18;
    const total=width*4+gap*3;
    const x=W/2-total/2+index*(width+gap);
    return {x, y:230, w:width, h:height};
  }
  menuStartRect(){return {x:W/2-145,y:420,w:290,h:58};}
  menuContinueRect(){return {x:W/2-145,y:492,w:290,h:52};}

  handleMenuClick(p){
    const diffs=[1,3,5,7];const names=['小学 / PEP词汇','初中 / 高中词汇','普通 / 四六级词汇','困难 / 雅思词汇'];
    for(let i=0;i<4;i++){
      const r=this.menuDifficultyRect(i);
      if(ptInRect(p,r)){
        this.playSound('ui_click');this.selectDifficulty(diffs[i],names[i]);return;
      }
    }
    if(ptInRect(p,this.menuStartRect())){this.playSound('ui_click');this.startSelectedGame();}
    else if(ptInRect(p,this.menuContinueRect())&&this.saveData.hasContinue){this.playSound('ui_click');this.continueGame();}
  }

  handleRewardClick(p){
    for(let i=0;i<this.rewardCards.length;i++){
      if(ptInRect(p,this.rewardCardRect(i))){this.chooseReward(i);return;}
    }
  }

  selectDifficulty(max, name){this.selectedMode=max;this.selectedModeName=name;}
  startSelectedGame(){this.startGame(this.selectedMode, this.selectedModeName);}

  // ── Game start ──────────────────────────────────────────────
  startGame(maxDifficulty, modeName, enterFirstRoom=true){
    this.selectedMode=maxDifficulty;this.selectedModeName=modeName;
    this.bankWords=this.allWords.filter(w=>w.difficulty<=maxDifficulty);
    if(this.bankWords.length===0) this.bankWords=[...this.allWords];
    this.player=new Player();
    this.monsters=[];this.meanings=[];this.projectiles=[];this.enemyProjectiles=[];
    this.drops=[];this.chests=[];this.floatingTexts=[];this.obstacles=[];
    this.runWords=[];this.room=0;this.combo=0;this.streakWrong=0;
    this.correctHits=0;this.wrongHits=0;this.collisions=0;
    this.roomDifficultyScale=1;this.message='';
    this.speedBoostRooms=0;this.throwBoostRooms=0;this.dashBoostRooms=0;
    this.pickupBoostRooms=0;this.piercingInkRooms=0;this.echoScrollRooms=0;
    this.tempSpeedBonus=0;this.tempThrowBonus=0;this.tempDashBonus=0;
    this.tempPickupBonus=0;this.lastMoveDir=new Vec2(0,1);this.playerFacing=0;
    this.saveData.hasContinue=false;
    this.state=GameState.Playing;
    if(enterFirstRoom) this.startRoom();
  }

  continueGame(){
    if(!this.saveData.hasContinue) return;
    const sd = this.saveData;
    this.startGame(sd.continueMode<=0?1:sd.continueMode, sd.continueModeName||'小学 / PEP词汇', false);
    this.room=Math.max(0, (sd.continueRoom||1)-1);
    this.player.hp=sd.continueHp>0?Math.min(this.player.maxHp,sd.continueHp):this.player.maxHp;
    if(sd.continueSpeed>0) this.player.speed=sd.continueSpeed;
    if(sd.continueDashCooldown>0) this.player.dashCooldown=sd.continueDashCooldown;
    if(sd.continueThrowSpeed>0) this.player.throwSpeed=sd.continueThrowSpeed;
    if(sd.continuePickupRange>0) this.player.pickupRange=sd.continuePickupRange;
    this.player.defense=Math.max(0,sd.continueDefense);
    this.player.luck=Math.max(0,sd.continueLuck);
    this.piercingInkRooms=Math.max(0,sd.continuePiercingInkRooms);
    this.echoScrollRooms=Math.max(0,sd.continueEchoScrollRooms);
    this.speedBoostRooms=Math.max(0,sd.continueSpeedBoostRooms);
    this.throwBoostRooms=Math.max(0,sd.continueThrowBoostRooms);
    this.dashBoostRooms=Math.max(0,sd.continueDashBoostRooms);
    this.pickupBoostRooms=Math.max(0,sd.continuePickupBoostRooms);
    this.tempSpeedBonus=Math.max(0,sd.continueTempSpeedBonus);
    this.tempThrowBonus=Math.max(0,sd.continueTempThrowBonus);
    this.tempDashBonus=Math.max(0,sd.continueTempDashBonus);
    this.tempPickupBonus=Math.max(0,sd.continueTempPickupBonus);
    this.player.piercingInk=this.piercingInkRooms>0;
    this.player.echoScroll=this.echoScrollRooms>0;
    this.startRoom(false);
    this.message='继续游戏：第 '+this.room+' 间';
  }

  // ── Room management ─────────────────────────────────────────
  startRoom(advancePowerups=true){
    this.state=GameState.Playing;
    this.room++;
    if(advancePowerups) this.advanceRoomLimitedPowerups();
    this.monsters=[];this.meanings=[];this.projectiles=[];this.enemyProjectiles=[];
    this.drops=[];this.chests=[];this.floatingTexts=[];this.obstacles=[];
    this.player.pos=new Vec2(W/2,H/2+160);
    this.player.heldMeaning='';
    this.roomTime=0;this.clearDelay=0;
    this.correctHits=0;this.wrongHits=0;this.collisions=0;this.showBook=false;
    this.generateObstacles();

    let targetCount = 3 + Math.min(3, Math.floor(this.room/2));
    if(this.roomDifficultyScale>1.15) targetCount++;
    if(this.selectedMode>=4&&this.room>3) targetCount++;
    if(this.selectedMode>=6&&this.room>5) targetCount++;
    targetCount = Math.min(6, targetCount);
    targetCount = Math.min(targetCount, Math.max(1, this.bankWords.length));

    const chosen = this.pickRoomWords(targetCount);
    for(const entry of chosen){
      entry.seenCount++;
      entry.lastSeenRoom = this.room;
      if(!this.runWords.includes(entry)) this.runWords.push(entry);

      const m = new Monster(entry);
      m.maxHp = (this.room>4||entry.difficulty>=4)?2:1;
      m.hp = m.maxHp;
      m.kind = this.pickMonsterKind(entry);
      m.shieldUp = m.kind === MonsterKind.Shield;
      m.fromMistake = entry.wrongCount > entry.correctCount && Math.random()<0.35;
      if(m.fromMistake) m.kind = MonsterKind.Ghost;
      m.pos = this.randomFreePosition(m.radius+8);
      m.thinkTimer = Math.random()*1.2;
      m.shootTimer = 1.4 + Math.random()*2.3;
      this.monsters.push(m);
    }

    this.spawnMeaningTokens();
    if(Math.random()<0.52) this.chests.push(new Chest(this.randomFreePosition(42)));
    this.message = '第 '+this.room+' 间：'+THEMES[(this.room-1)%THEMES.length].name;
    if(targetCount > 3){
      this.prepareRewardCards();
      this.state = GameState.RewardChoice;
      this.message = '选择一张奖励卡后开始房间';
    }
    this.saveContinueState();
  }

  advanceRoomLimitedPowerups(){
    if(this.room<=1) return;
    if(this.speedBoostRooms>0&&--this.speedBoostRooms===0&&this.tempSpeedBonus>0){
      this.player.speed=Math.max(120,this.player.speed-this.tempSpeedBonus);this.tempSpeedBonus=0;
      this.addFloat('速度道具失效',this.player.pos.add(new Vec2(-30,-36)),'#dcdcdc');
    }
    if(this.throwBoostRooms>0&&--this.throwBoostRooms===0&&this.tempThrowBonus>0){
      this.player.throwSpeed=Math.max(260,this.player.throwSpeed-this.tempThrowBonus);this.tempThrowBonus=0;
      this.addFloat('弹速道具失效',this.player.pos.add(new Vec2(-30,-36)),'#dcdcdc');
    }
    if(this.dashBoostRooms>0&&--this.dashBoostRooms===0&&this.tempDashBonus>0){
      this.player.dashCooldown+=this.tempDashBonus;this.tempDashBonus=0;
      this.addFloat('轻羽失效',this.player.pos.add(new Vec2(-30,-36)),'#dcdcdc');
    }
    if(this.pickupBoostRooms>0&&--this.pickupBoostRooms===0&&this.tempPickupBonus>0){
      this.player.pickupRange=Math.max(60,this.player.pickupRange-this.tempPickupBonus);this.tempPickupBonus=0;
      this.addFloat('磁力手套失效',this.player.pos.add(new Vec2(-30,-36)),'#dcdcdc');
    }
    if(this.piercingInkRooms>0&&--this.piercingInkRooms===0){
      this.player.piercingInk=false;
      this.addFloat('穿透墨水失效',this.player.pos.add(new Vec2(-30,-36)),'#dcdcdc');
    }
    if(this.echoScrollRooms>0&&--this.echoScrollRooms===0){
      this.player.echoScroll=false;
      this.addFloat('回声卷轴失效',this.player.pos.add(new Vec2(-30,-36)),'#dcdcdc');
    }
  }

  pickMonsterKind(entry){
    const roll=Math.floor(Math.random()*100);
    const tier=this.room+entry.difficulty;
    if(tier>8&&roll<18) return MonsterKind.Shield;
    if(tier>6&&roll<38) return MonsterKind.Dasher;
    if(tier>4&&roll<68) return MonsterKind.Chaser;
    return MonsterKind.Wanderer;
  }

  pickRoomWords(count){
    const selected=[];
    const pool=[...this.bankWords];
    for(let i=0;i<count&&pool.length>0;i++){
      let total=0;
      const weights=[];
      for(const w of pool){
        const targetDiff = 1+this.room*0.42;
        let diffScore = 40 - Math.abs(w.difficulty-targetDiff)*9;
        let weight = Math.max(6, diffScore);
        if(w.seenCount===0) weight+=30;
        weight+=w.wrongCount*20;
        weight+=w.deathCount*50;
        weight-=w.mastery*8;
        if(this.room-w.lastSeenRoom<=3&&w.lastSeenRoom>0) weight-=30;
        if(w.correctCount>=3&&w.wrongCount===0) weight-=18;
        weight=Math.max(2,weight);
        total+=weight;weights.push(weight);
      }
      let pick=Math.random()*total, acc=0;
      for(let j=0;j<pool.length;j++){
        acc+=weights[j];
        if(pick<=acc){
          selected.push(pool[j]);
          pool.splice(j,1);break;
        }
      }
    }
    return selected;
  }

  spawnMeaningTokens(){
    const used=new Set();
    for(const m of this.monsters){
      const needed=Math.max(1,Math.ceil(m.maxHp)+(m.shieldUp?1:0));
      for(let i=0;i<needed;i++) this.addMeaningToken(m.entry.meaning,true);
      used.add(m.entry.meaning);
    }
    let distractorCount=Math.max(5,this.monsters.length+3);
    const candidates=[...this.allWords].sort(()=>Math.random()-0.5);
    for(const w of candidates){
      if(used.has(w.meaning)) continue;
      let sameTheme=false;
      for(const m of this.monsters){if(this.shareTag(w,m.entry)) sameTheme=true;}
      if(sameTheme||Math.random()<0.35){
        this.addMeaningToken(w.meaning,false);used.add(w.meaning);
        if(--distractorCount<=0) break;
      }
    }
  }

  shareTag(a,b){
    if(!a.tags||!b.tags) return false;
    for(const x of a.tags) for(const y of b.tags) if(x===y) return true;
    return false;
  }

  addMeaningToken(meaning, correct){
    return this.addMeaningTokenAt(meaning, correct, this.findMeaningTokenPosition(meaning, 100));
  }

  addMeaningTokenAt(meaning, correct, pos){
    if(!this.isMeaningTokenPositionFree(meaning, pos, 30)){
      pos = this.findMeaningTokenPosition(meaning, 70);
    }
    const token = new MeaningToken(meaning, pos, correct);
    if(correct && this.roomDifficultyScale<0.92) token.glowTimer=6;
    this.meanings.push(token);
    return token;
  }

  findMeaningTokenPosition(meaning, playerClearance){
    for(let attempt=0;attempt<260;attempt++){
      const p=new Vec2(80+Math.random()*(W-160), 100+Math.random()*(H-170));
      if(this.isMeaningTokenPositionFree(meaning,p,playerClearance)) return p;
    }
    for(let y=102;y<H-70;y+=38){
      for(let x=72;x<W-72;x+=54){
        const p=new Vec2(x,y);
        if(this.isMeaningTokenPositionFree(meaning,p,Math.min(50,playerClearance))) return p;
      }
    }
    return this.randomFreePosition(48);
  }

  isMeaningTokenPositionFree(meaning, pos, playerClearance){
    const bounds=this.meaningTokenBounds(meaning,pos);
    if(bounds.x<44||bounds.x+bounds.w>W-44) return false;
    if(bounds.y<78||bounds.y+bounds.h>H-44) return false;
    if(this.distPointToRect(this.player.pos,bounds)<this.player.radius+playerClearance) return false;
    for(const ob of this.obstacles){
      if(rectsOverlap(inflateRect(obstacleCollisionBounds(ob),8,8),bounds)) return false;
    }
    for(const m of this.monsters){
      if(this.distPointToRect(m.pos,bounds)<m.radius+18) return false;
    }
    for(const c of this.chests){
      if(!c.opened&&this.distPointToRect(c.pos,bounds)<42) return false;
    }
    const padded=inflateRect(bounds,10,7);
    for(const t of this.meanings){
      if(rectsOverlap(padded,this.meaningTokenBounds(t.meaning,t.pos))) return false;
    }
    return true;
  }

  meaningTokenBounds(meaning, pos){
    const width=clamp(this.estimateMeaningTextWidth(meaning)+28,56,220);
    return {x:pos.x-width/2, y:pos.y-16, w:width, h:32};
  }

  estimateMeaningTextWidth(meaning){
    if(!meaning) return 28;
    let w=0;
    for(const c of meaning) w += c.charCodeAt(0)<=127?8.5:15.5;
    return w;
  }

  randomFreePosition(radius=34){
    for(let attempt=0;attempt<80;attempt++){
      const p=new Vec2(100+Math.random()*(W-200), 110+Math.random()*(H-210));
      if(p.distTo(this.player.pos)<130) continue;
      if(this.isCircleBlocked(p,radius)) continue;
      let ok=true;
      for(const m of this.monsters) if(p.distTo(m.pos)<90) ok=false;
      if(ok) return p;
    }
    for(let x=90;x<W-90;x+=44){
      for(let y=110;y<H-80;y+=44){
        const p=new Vec2(x,y);
        if(!this.isCircleBlocked(p,radius)&&p.distTo(this.player.pos)>=90) return p;
      }
    }
    return this.player.pos.clone();
  }

  // ── Obstacle generation ─────────────────────────────────────
  generateObstacles(){
    this.obstacles=[];
    const themeIndex=(this.room-1+THEMES.length)%THEMES.length;
    let target=6+Math.floor(Math.random()*4)+Math.min(3,Math.floor(this.room/4));
    if(themeIndex===7) target+=2;
    for(let attempt=0;attempt<target*18&&this.obstacles.length<target;attempt++){
      const ob=this.createRandomObstacle(themeIndex);
      if(!this.canPlaceObstacle(ob)) continue;
      this.obstacles.push(ob);
      if(!this.roomNavigationIsValid()) this.obstacles.pop();
    }
  }

  createRandomObstacle(themeIndex){
    const ob=new Obstacle();
    ob.spriteIndex=themeIndex;
    let w=72+Math.random()*70, h=44+Math.random()*58;
    let kind='障碍', fill='rgb(100,125,95)', stroke='rgb(43,54,39)';
    if(themeIndex===0){w=46+Math.random()*30;h=46+Math.random()*30;kind='树木';fill='rgb(70,136,68)';stroke='rgb(31,73,38)';}
    else if(themeIndex===1){w=96+Math.random()*54;h=42+Math.random()*32;kind='办公桌';fill='rgb(118,103,82)';stroke='rgb(58,49,38)';}
    else if(themeIndex===2){w=54+Math.random()*32;h=118+Math.random()*52;kind='书架';fill='rgb(112,78,105)';stroke='rgb(54,38,58)';}
    else if(themeIndex===3){w=108+Math.random()*54;h=48+Math.random()*34;kind='实验桌';fill='rgb(70,116,126)';stroke='rgb(35,66,74)';}
    else if(themeIndex===4){w=70+Math.random()*42;h=78+Math.random()*54;kind='写字楼';fill='rgb(132,116,91)';stroke='rgb(67,56,43)';}
    else if(themeIndex===5){w=58+Math.random()*34;h=118+Math.random()*54;kind='书架';fill='rgb(111,105,137)';stroke='rgb(55,53,78)';}
    else if(themeIndex===6){w=96+Math.random()*42;h=48+Math.random()*24;kind='汽车';fill='rgb(72,137,166)';stroke='rgb(33,73,92)';}
    else if(themeIndex===7){w=40+Math.random()*34;h=34+Math.random()*30;kind='花草';fill='rgb(101,154,92)';stroke='rgb(57,91,53)';}
    ob.bounds={x:72+Math.random()*Math.max(1,W-144-w), y:98+Math.random()*Math.max(1,H-170-h), w, h};
    ob.kind=kind;ob.fill=fill;ob.stroke=stroke;
    return ob;
  }

  canPlaceObstacle(candidate){
    const cb=obstacleCollisionBounds(candidate);
    const padded=inflateRect(cb,30,30);
    if(padded.y<78||padded.x<42||padded.x+padded.w>W-42||padded.y+padded.h>H-48) return false;
    if(ptInRect(this.player.pos,padded)) return false;
    if(this.distPointToRect(this.player.pos,cb)<150) return false;
    const startArea={x:W/2-95,y:H/2+95,w:190,h:150};
    const centerArea={x:W/2-100,y:H/2-80,w:200,h:160};
    if(rectsOverlap(cb,startArea)||rectsOverlap(cb,centerArea)) return false;
    for(const ob of this.obstacles) if(rectsOverlap(padded,obstacleCollisionBounds(ob))) return false;
    return true;
  }

  roomNavigationIsValid(){
    const cell=40;
    const cols=Math.floor((W-96)/cell), rows=Math.floor((H-140)/cell);
    const blocked=[];
    let totalWalkable=0, startX=-1, startY=-1;
    for(let x=0;x<cols;x++){
      blocked[x]=[];
      for(let y=0;y<rows;y++){
        const center=new Vec2(48+x*cell+cell/2, 82+y*cell+cell/2);
        blocked[x][y]=this.isCircleBlocked(center,18);
        if(!blocked[x][y]){
          totalWalkable++;
          if(startX<0||center.distTo(this.player.pos)<new Vec2(48+startX*cell+cell/2,82+startY*cell+cell/2).distTo(this.player.pos)){
            startX=x;startY=y;
          }
        }
      }
    }
    if(totalWalkable<cols*rows*0.62||startX<0) return false;
    const seen=[];
    for(let x=0;x<cols;x++){seen[x]=[];for(let y=0;y<rows;y++) seen[x][y]=false;}
    const queue=[{x:startX,y:startY}];
    seen[startX][startY]=true;
    let visited=0;
    while(queue.length>0){
      const p=queue.shift();visited++;
      const neighbors=[{x:p.x+1,y:p.y},{x:p.x-1,y:p.y},{x:p.x,y:p.y+1},{x:p.x,y:p.y-1}];
      for(const n of neighbors){
        if(n.x<0||n.y<0||n.x>=cols||n.y>=rows) continue;
        if(blocked[n.x][n.y]||seen[n.x][n.y]) continue;
        seen[n.x][n.y]=true;queue.push(n);
      }
    }
    return visited>=totalWalkable*0.9;
  }

  isCircleBlocked(center, radius){
    if(center.x-radius<34||center.x+radius>W-34) return true;
    if(center.y-radius<66||center.y+radius>H-34) return true;
    for(const ob of this.obstacles) if(circleIntersectsRect(center,radius,obstacleCollisionBounds(ob))) return true;
    return false;
  }

  moveCircle(start, delta, radius){
    const steps=Math.max(1,Math.ceil(delta.len()/12));
    const step=delta.mul(1/steps);
    let pos=start.clone();
    for(let i=0;i<steps;i++){
      const nx=new Vec2(pos.x+step.x,pos.y);
      if(!this.isCircleBlocked(nx,radius)) pos=nx;
      const ny=new Vec2(pos.x,pos.y+step.y);
      if(!this.isCircleBlocked(ny,radius)) pos=ny;
    }
    return pos;
  }

  ensurePlayerNotStuck(){
    if(!this.isCircleBlocked(this.player.pos,this.player.radius)) return;
    const orig=this.player.pos;
    for(let ring=1;ring<=9;ring++){
      const dist=ring*18;
      for(let i=0;i<24;i++){
        const angle=Math.PI*2*i/24;
        const cand=orig.add(new Vec2(Math.cos(angle),Math.sin(angle)).mul(dist));
        if(!this.isCircleBlocked(cand,this.player.radius)){
          this.player.pos=cand;
          this.addFloat('脱离卡位',this.player.pos.add(new Vec2(-20,-30)),'#b4e6ff');
          return;
        }
      }
    }
    this.player.pos=new Vec2(W/2,H/2+160);
  }

  distPointToRect(point, rect){
    const dx=Math.max(Math.max(rect.x-point.x,0),point.x-(rect.x+rect.w));
    const dy=Math.max(Math.max(rect.y-point.y,0),point.y-(rect.y+rect.h));
    return Math.sqrt(dx*dx+dy*dy);
  }

  // ── Game tick ───────────────────────────────────────────────
  updatePlaying(dt){
    this.roomTime+=dt;
    this.updatePlayer(dt);
    this.updateMonsters(dt);
    this.updateProjectiles(dt);
    this.updateEnemyProjectiles(dt);
    this.updateDrops(dt);
    this.updateFloatingText(dt);
    if(this.monsters.length===0) this.onRoomCleared();
    if(this.player.hp<=0){
      for(const m of this.monsters) m.entry.deathCount++;
      this.state=GameState.GameOver;this.endScrollOffset=0;
      this.message='探险失败。按 Enter 回到主菜单。';
      this.saveData.hasContinue=false;this.save();
    }
    if(this.mouseLeftDown&&this.player.heldMeaning.length>0) this.mouseLeftDown=false;
  }

  updatePlayer(dt){
    const input=this.getMoveInput();
    if(Math.abs(input.x)>0.05||Math.abs(input.y)>0.05){
      this.lastMoveDir=input;this.walkAnimTime+=dt;
      if(Math.abs(input.x)>Math.abs(input.y)) this.playerFacing=input.x<0?1:2;
      else this.playerFacing=input.y<0?3:0;
    } else {
      this.walkAnimTime=0;
      this.updateFacingFromAim(false);
    }
    let speed=this.player.speed;
    if(this.player.speedBoost>0) speed*=1.35;
    this.player.pos=this.moveCircle(this.player.pos,input.mul(speed*dt),this.player.radius);
    this.player.pos.x=clamp(this.player.pos.x,48,W-48);
    this.player.pos.y=clamp(this.player.pos.y,78,H-48);
    if(this.player.dashTimer>0) this.player.dashTimer-=dt;
    if(this.player.invulnerable>0) this.player.invulnerable-=dt;
    if(this.player.speedBoost>0) this.player.speedBoost-=dt;
    if(this.player.shieldTime>0) this.player.shieldTime-=dt;
    if(this.dashAnimTime>0) this.dashAnimTime-=dt;
    if(this.fireAnimTime>0) this.fireAnimTime-=dt;
    this.ensurePlayerNotStuck();
  }

  getMoveInput(){
    let input=new Vec2(0,0);
    // Keyboard
    if(this.keys.has('KeyW')||this.keys.has('ArrowUp')) input.y-=1;
    if(this.keys.has('KeyS')||this.keys.has('ArrowDown')) input.y+=1;
    if(this.keys.has('KeyA')||this.keys.has('ArrowLeft')) input.x-=1;
    if(this.keys.has('KeyD')||this.keys.has('ArrowRight')) input.x+=1;
    // Touch joystick
    if(this.touchJoyActive && this.touchJoyDir.len()>0.1){
      input = this.touchJoyDir;
    }
    return input.norm();
  }

  updateFacingFromAim(force){
    const aim=this.mouse.sub(this.player.pos).norm();
    if(!force&&aim.len()<0.001) return;
    if(Math.abs(aim.x)>Math.abs(aim.y)) this.playerFacing=aim.x<0?1:2;
    else this.playerFacing=aim.y<0?3:0;
  }

  updateMonsters(dt){
    for(const m of this.monsters){
      if(m.rageTimer>0) m.rageTimer-=dt;
      let speed=55+this.room*3+m.entry.difficulty*8;
      if(m.kind===MonsterKind.Chaser) speed+=28;
      if(m.kind===MonsterKind.Ghost) speed+=38;
      if(m.rageTimer>0) speed*=1.8;
      if(this.roomDifficultyScale<0.95) speed*=0.85;
      if(this.roomDifficultyScale>1.1) speed*=1.12;

      const toPlayer=this.player.pos.sub(m.pos).norm();
      if(m.kind===MonsterKind.Wanderer||m.kind===MonsterKind.Shield){
        m.thinkTimer-=dt;
        if(m.thinkTimer<=0){
          const a=Math.random()*Math.PI*2;
          m.vel=new Vec2(Math.cos(a),Math.sin(a));
          m.thinkTimer=0.8+Math.random()*1.4;
        }
        if(this.player.pos.distTo(m.pos)<180) m.vel=m.vel.mul(0.75).add(toPlayer.mul(0.25)).norm();
      } else if(m.kind===MonsterKind.Chaser||m.kind===MonsterKind.Ghost){
        m.vel=m.vel.mul(0.82).add(toPlayer.mul(0.18)).norm();
      } else if(m.kind===MonsterKind.Dasher){
        if(m.dashWindup>0){
          m.dashWindup-=dt;
          if(m.dashWindup<=0) m.vel=toPlayer.mul(4.2);
        } else {
          m.thinkTimer-=dt;
          m.vel=m.vel.mul(0.94);
          if(m.thinkTimer<=0&&this.player.pos.distTo(m.pos)<360){
            m.dashWindup=0.55;m.thinkTimer=2.2;
          } else if(m.vel.len()<0.1) m.vel=toPlayer.mul(0.45);
        }
      }

      m.pos=this.moveCircle(m.pos,m.vel.mul(speed*dt),m.radius);
      if(m.vel.x>0.05) m.facingRight=true;
      else if(m.vel.x<-0.05) m.facingRight=false;

      // Touch damage
      const touch=m.pos.distTo(this.player.pos);
      if(touch<m.radius+this.player.radius&&this.player.invulnerable<=0){
        let damage=12+m.entry.difficulty*1.8;
        damage*=1-this.player.defense;
        if(this.player.shieldTime>0) damage*=0.55;
        this.player.hp-=damage;
        this.player.invulnerable=0.55;
        this.collisions++;
        this.addFloat('-'+Math.floor(damage),this.player.pos.add(new Vec2(0,-24)),'#ff7373');
        const push=this.player.pos.sub(m.pos).norm();
        this.player.pos=this.moveCircle(this.player.pos, push.mul(34), this.player.radius);
        this.ensurePlayerNotStuck();
      }

      // Elite shooting
      if(this.isEliteMonster(m)){
        m.shootTimer-=dt;
        const dist=this.player.pos.distTo(m.pos);
        if(m.shootTimer<=0&&dist<520&&dist>70&&this.hasLineOfSight(m.pos,this.player.pos)){
          const dir=this.player.pos.sub(m.pos).norm();
          const bullet=new EnemyProjectile(
            m.pos.add(dir.mul(m.radius+12)),
            dir.mul(210+this.room*8+m.entry.difficulty*12)
          );
          bullet.life=3.2;bullet.damage=9+m.entry.difficulty*1.6;
          this.enemyProjectiles.push(bullet);
          m.shootTimer=Math.max(1.25,3.3-this.room*0.08-m.entry.difficulty*0.08);
          this.addFloat('精英弹幕',m.pos.add(new Vec2(-22,-42)),'#ff9c74');
        }
      }
    }
  }

  isEliteMonster(m){return m.maxHp>=2||m.kind===MonsterKind.Shield||m.entry.difficulty>=5;}

  hasLineOfSight(from, to){
    const delta=to.sub(from);const len=delta.len();
    if(len<0.001) return true;
    const step=delta.norm().mul(18);
    let p=from.clone();
    for(let i=0;i<len/18;i++){
      p=p.add(step);
      for(const ob of this.obstacles) if(circleIntersectsRect(p,8,obstacleCollisionBounds(ob))) return false;
    }
    return true;
  }

  updateProjectiles(dt){
    for(let i=this.projectiles.length-1;i>=0;i--){
      const p=this.projectiles[i];
      p.pos=p.pos.add(p.vel.mul(dt));p.life-=dt;
      let remove=p.life<=0||p.pos.x<-40||p.pos.x>W+40||p.pos.y<-40||p.pos.y>H+40;
      if(!remove) for(const ob of this.obstacles) if(circleIntersectsRect(p.pos,8,obstacleCollisionBounds(ob))){
        this.addFloat('被障碍挡住',p.pos.add(new Vec2(-18,-22)),'#e6dc96');remove=true;break;
      }
      if(!remove){
        for(let j=this.monsters.length-1;j>=0;j--){
          const m=this.monsters[j];
          if(p.hit.has(m)) continue;
          if(p.pos.distTo(m.pos)<m.radius+9){
            p.hit.add(m);
            const effective=this.resolveHit(p,m);
            if(effective){p.returnOnMiss=false;if(!p.piercing) remove=true;}
            else{this.returnProjectileMeaning(p);remove=true;}
            if(this.monsters.length===0) break;
          }
        }
      }
      if(remove){this.returnProjectileMeaning(p);this.projectiles.splice(i,1);}
    }
  }

  updateEnemyProjectiles(dt){
    for(let i=this.enemyProjectiles.length-1;i>=0;i--){
      const b=this.enemyProjectiles[i];
      b.pos=b.pos.add(b.vel.mul(dt));b.life-=dt;
      let remove=b.life<=0||b.pos.x<-30||b.pos.x>W+30||b.pos.y<-30||b.pos.y>H+30;
      if(!remove) for(const ob of this.obstacles) if(circleIntersectsRect(b.pos,8,obstacleCollisionBounds(ob))){remove=true;break;}
      if(!remove&&b.pos.distTo(this.player.pos)<this.player.radius+9&&this.player.invulnerable<=0){
        let damage=b.damage*(1-this.player.defense);
        if(this.player.shieldTime>0) damage*=0.55;
        this.player.hp-=damage;this.player.invulnerable=0.42;this.collisions++;
        this.addFloat('弹幕 -'+Math.floor(damage),this.player.pos.add(new Vec2(-8,-34)),'#ff846c');
        remove=true;
      }
      if(remove) this.enemyProjectiles.splice(i,1);
    }
  }

  resolveHit(p, m){
    const correct=p.universal||p.meaning===m.entry.meaning;
    if(correct){
      this.correctHits++;this.saveData.totalCorrect++;
      if(!p.universal){m.entry.correctCount++;m.entry.mastery=Math.min(10,m.entry.mastery+1);}
      this.combo++;this.streakWrong=0;
      if(m.shieldUp){
        m.shieldUp=false;
        this.addFloat(p.universal?'回声破盾':'破盾',m.pos.add(new Vec2(0,-36)),'#7ad3ff');
        m.rageTimer=0.6;return true;
      }
      let damage=m.maxHp>=2?1:99;
      if(this.combo>=3){damage+=1;this.player.hp=Math.min(this.player.maxHp,this.player.hp+4);
        this.addFloat('连击+'+this.combo,this.player.pos.add(new Vec2(0,-34)),'#94ffa6');}
      m.hp-=damage;
      this.playSound('hit_correct');
      this.addFloat(p.universal?'回声命中':'正确：'+m.entry.meaning,m.pos.add(new Vec2(0,-38)),'#98f5b4');
      if(m.hp<=0) this.killMonster(m);
      return true;
    } else {
      this.wrongHits++;this.saveData.totalWrong++;
      m.entry.wrongCount++;m.entry.mastery=Math.max(0,m.entry.mastery-1);
      this.combo=0;this.streakWrong++;m.rageTimer=3;
      m.hp-=0.15;
      this.addFloat('错配！'+m.entry.word+' = '+m.entry.meaning,m.pos.add(new Vec2(0,-38)),'#ffd25e');
      if(this.streakWrong>=2){
        this.roomDifficultyScale+=0.08;
        this.addFloat('房间躁动',new Vec2(W/2-40,120),'#ff8282');
        this.streakWrong=0;
      }
      return false;
    }
  }

  returnProjectileMeaning(p){
    if(!p.returnOnMiss||p.universal||p.meaning.length===0||this.monsters.length===0) return;
    const correctForRemaining=this.monsters.some(m=>m.entry.meaning===p.meaning);
    const token=this.addMeaningToken(p.meaning,correctForRemaining);
    p.returnOnMiss=false;
    this.addFloat('词块刷新：'+p.meaning,token.pos.add(new Vec2(-22,-28)),'#ece084');
  }

  killMonster(m){
    this.addFloat('记住 '+m.entry.word, m.pos.add(new Vec2(0,-58)), '#ffffff');
    const lastMonster=this.monsters.length===1;
    if(Math.random()<0.16+this.player.luck){
      const kind=Math.floor(Math.random()*7);
      if(lastMonster){this.applyDrop(kind);this.addFloat('自动拾取：'+DROP_NAMES[kind],m.pos.add(new Vec2(-26,-30)),'#ffe275');}
      else this.drops.push(new Drop(kind,m.pos.clone()));
    }
    const idx=this.monsters.indexOf(m);
    if(idx>=0) this.monsters.splice(idx,1);
  }

  updateDrops(dt){
    for(let i=this.drops.length-1;i>=0;i--){
      this.drops[i].life-=dt;
      if(this.drops[i].pos.distTo(this.player.pos)<34){
        this.applyDrop(this.drops[i].kind);
        this.drops.splice(i,1);continue;
      }
      if(this.drops[i].life<=0) this.drops.splice(i,1);
    }
  }

  updateFloatingText(dt){
    for(let i=this.floatingTexts.length-1;i>=0;i--){
      this.floatingTexts[i].life-=dt;
      this.floatingTexts[i].pos.y-=24*dt;
      if(this.floatingTexts[i].life<=0) this.floatingTexts.splice(i,1);
    }
  }

  // ── Actions ─────────────────────────────────────────────────
  tryDash(){
    if(this.player.dashTimer>0||(this.state!==GameState.Playing&&this.state!==GameState.RoomClear)) return;
    let dir=this.getMoveInput();
    if(dir.len()<0.001) dir=this.lastMoveDir;
    if(dir.len()<0.001) dir=this.facingVector();
    this.player.pos=this.moveCircle(this.player.pos,dir.mul(128),this.player.radius);
    this.player.pos.x=clamp(this.player.pos.x,48,W-48);
    this.player.pos.y=clamp(this.player.pos.y,78,H-48);
    this.player.dashTimer=this.player.dashCooldown;
    this.player.invulnerable=0.28;
    this.dashAnimTime=0.22;
  }

  tryInteract(){
    if(this.state===GameState.RoomClear){this.clearDelay=0;return;}
    let best=null, bestDist=this.player.pickupRange;
    for(const t of this.meanings){
      const d=t.pos.distTo(this.player.pos);
      if(d<bestDist){best=t;bestDist=d;}
    }
    if(best){
      if(this.player.heldMeaning.length>0) this.dropHeldMeaning();
      this.player.heldMeaning=best.meaning;
      const idx=this.meanings.indexOf(best);
      if(idx>=0) this.meanings.splice(idx,1);
      this.addFloat('拾取：'+best.meaning,this.player.pos.add(new Vec2(0,-30)),'#eaef9c');
      return;
    }
    for(const c of this.chests){
      if(!c.opened&&c.pos.distTo(this.player.pos)<70){
        c.opened=true;this.openChest();return;
      }
    }
  }

  dropHeldMeaning(){
    if(this.player.heldMeaning.length===0) return;
    const correctForRemaining=this.monsters.some(m=>m.entry.meaning===this.player.heldMeaning);
    const pos=this.findMeaningTokenPosition(this.player.heldMeaning,50);
    this.addMeaningTokenAt(this.player.heldMeaning,correctForRemaining,pos);
    this.addFloat('脱落：'+this.player.heldMeaning,pos.add(new Vec2(-20,-30)),'#ece084');
    this.player.heldMeaning='';
  }

  usePotion(){
    if(this.player.shieldTime<=0){
      this.player.shieldTime=5;
      this.addFloat('护盾药剂',this.player.pos.add(new Vec2(0,-34)),'#7ccdff');
    }
  }

  fireHeldMeaning(echo){
    if(this.player.heldMeaning.length===0) return;
    const dir=this.getAimDirection();
    if(dir.len()<0.001) return;
    this.updateFacingFromAim(true);
    const p=new Projectile(this.player.heldMeaning, this.getMuzzlePosition(dir), dir.mul(this.player.throwSpeed));
    p.piercing=this.player.piercingInk;
    this.projectiles.push(p);
    this.fireAnimTime=0.16;
    if(this.player.echoScroll&&!echo){
      const side=new Vec2(-dir.y,dir.x);
      const p2=new Projectile('回声',this.getMuzzlePosition(dir).add(side.mul(11)),
        dir.mul(0.94).add(side.mul(0.15)).norm().mul(this.player.throwSpeed*0.95));
      p2.life=1.45;p2.piercing=this.player.piercingInk;p2.universal=true;p2.returnOnMiss=false;
      this.projectiles.push(p2);
    }
    this.player.heldMeaning='';
  }

  getAimDirection(){
    const dir=this.mouse.sub(this.player.pos).norm();
    return dir.len()<0.001?new Vec2(1,0):dir;
  }

  getMuzzlePosition(dir){
    const recoil=this.fireAnimTime>0?5:0;
    return this.player.pos.add(dir.mul(42-recoil)).add(new Vec2(0,-8));
  }

  facingVector(){
    if(this.playerFacing===1) return new Vec2(-1,0);
    if(this.playerFacing===2) return new Vec2(1,0);
    if(this.playerFacing===3) return new Vec2(0,-1);
    return new Vec2(0,1);
  }

  applyDrop(kind){
    if(kind===DropKind.Apple){this.player.hp=Math.min(this.player.maxHp,this.player.hp+this.player.maxHp*0.3);this.addFloat('苹果 +HP',this.player.pos.add(new Vec2(0,-30)),'#a0ffae');}
    else if(kind===DropKind.Coffee){this.player.speedBoost=7;this.addFloat('咖啡 加速',this.player.pos.add(new Vec2(0,-30)),'#eac07e');}
    else if(kind===DropKind.ShieldPotion){this.player.shieldTime=10;this.addFloat('护盾 10s',this.player.pos.add(new Vec2(0,-30)),'#7ccdff');}
    else if(kind===DropKind.Ink){this.player.piercingInk=true;this.piercingInkRooms=3;this.addFloat('穿透墨水 3间',this.player.pos.add(new Vec2(-30,-42)),'#bcb1ff');}
    else if(kind===DropKind.Boots){this.grantSpeedBonus(18,'风之靴 3间');}
    else if(kind===DropKind.Feather){this.grantDashBonus(0.12,'轻羽 3间');}
    else if(kind===DropKind.Gloves){this.grantPickupBonus(18,'磁力手套 3间');}
    this.saveContinueState();
  }

  openChest(){
    const choice=Math.floor(Math.random()*3);
    if(choice===0){this.grantSpeedBonus(22,'宝箱：移速 3间');this.message='宝箱：移动速度提升 3间';}
    else if(choice===1){this.grantThrowBonus(90,'宝箱：弹速 3间');this.message='宝箱：弹丸速度提升 3间';}
    else{this.player.echoScroll=true;this.echoScrollRooms=3;this.addFloat('宝箱：回声卷轴 3间',this.player.pos.add(new Vec2(-30,-42)),'#ffe275');this.message='宝箱：回声卷轴生效 3间';}
    this.saveContinueState();
  }

  grantSpeedBonus(amount,label){
    if(this.tempSpeedBonus<=0){this.player.speed+=amount;this.tempSpeedBonus=amount;}
    else if(amount>this.tempSpeedBonus){this.player.speed+=amount-this.tempSpeedBonus;this.tempSpeedBonus=amount;}
    this.speedBoostRooms=3;this.addFloat(label,this.player.pos.add(new Vec2(-30,-42)),'#9fe1ff');
  }
  grantThrowBonus(amount,label){
    if(this.tempThrowBonus<=0){this.player.throwSpeed+=amount;this.tempThrowBonus=amount;}
    else if(amount>this.tempThrowBonus){this.player.throwSpeed+=amount-this.tempThrowBonus;this.tempThrowBonus=amount;}
    this.throwBoostRooms=3;this.addFloat(label,this.player.pos.add(new Vec2(-30,-42)),'#ffe275');
  }
  grantDashBonus(amount,label){
    if(this.tempDashBonus<=0){this.player.dashCooldown=Math.max(0.55,this.player.dashCooldown-amount);this.tempDashBonus=amount;}
    else if(amount>this.tempDashBonus){this.player.dashCooldown=Math.max(0.55,this.player.dashCooldown-(amount-this.tempDashBonus));this.tempDashBonus=amount;}
    this.dashBoostRooms=3;this.addFloat(label,this.player.pos.add(new Vec2(-30,-42)),'#f5f5d2');
  }
  grantPickupBonus(amount,label){
    if(this.tempPickupBonus<=0){this.player.pickupRange+=amount;this.tempPickupBonus=amount;}
    else if(amount>this.tempPickupBonus){this.player.pickupRange+=amount-this.tempPickupBonus;this.tempPickupBonus=amount;}
    this.pickupBoostRooms=3;this.addFloat(label,this.player.pos.add(new Vec2(-30,-42)),'#ffc778');
  }

  // ── Reward cards ────────────────────────────────────────────
  prepareRewardCards(){
    this.rewardCards=[];
    const hpPercent=0.2+Math.random()*0.3;
    const hpText=Math.round(hpPercent*100);
    this.rewardCards.push(new RewardCard(RewardKind.Survival,'生存类','生命补给','最大生命和当前生命 +'+hpText+'%',hpPercent));
    if(Math.random()<0.5) this.rewardCards.push(new RewardCard(RewardKind.MoveSpeed,'防御类','机动步伐','移动速度永久 +14',14));
    else this.rewardCards.push(new RewardCard(RewardKind.Shield,'防御类','能量护盾','减伤提升并获得护盾',0.06));
    const item=Math.floor(Math.random()*3);
    if(item===0) this.rewardCards.push(new RewardCard(RewardKind.ChestSpeed,'道具类','风箱补给','获得宝箱移速道具 3间',22));
    else if(item===1) this.rewardCards.push(new RewardCard(RewardKind.ChestThrow,'道具类','弹药校准','获得宝箱弹速道具 3间',90));
    else this.rewardCards.push(new RewardCard(RewardKind.ChestEcho,'道具类','回声卷轴','获得回声卷轴 3间',0));
  }

  rewardCardRect(index){
    const width=250,height=218,gap=28;
    const total=width*3+gap*2;
    const x=W/2-total/2+index*(width+gap);
    return {x,y:245,w:width,h:height};
  }

  chooseReward(index){
    if(this.state!==GameState.RewardChoice||index<0||index>=this.rewardCards.length) return;
    const card=this.rewardCards[index];
    this.applyReward(card);
    this.rewardCards=[];
    this.state=GameState.Playing;
    this.message='奖励生效：'+card.title;
    this.saveContinueState();
  }

  applyReward(card){
    if(card.kind===RewardKind.Survival){
      const gain=this.player.maxHp*card.value;
      this.player.maxHp+=gain;this.player.hp=Math.min(this.player.maxHp,this.player.hp+gain);
      this.addFloat('生命 +'+Math.floor(gain),this.player.pos.add(new Vec2(-20,-42)),'#a0ffae');
    } else if(card.kind===RewardKind.MoveSpeed){
      this.player.speed+=card.value;
      this.addFloat('移速 +'+Math.floor(card.value),this.player.pos.add(new Vec2(-20,-42)),'#9fe1ff');
    } else if(card.kind===RewardKind.Shield){
      this.player.defense=Math.min(0.35,this.player.defense+card.value);
      this.player.shieldTime=Math.max(this.player.shieldTime,12);
      this.addFloat('护盾强化',this.player.pos.add(new Vec2(-20,-42)),'#7ccdff');
    } else if(card.kind===RewardKind.ChestSpeed) this.grantSpeedBonus(card.value,'奖励：移速 3间');
    else if(card.kind===RewardKind.ChestThrow) this.grantThrowBonus(card.value,'奖励：弹速 3间');
    else if(card.kind===RewardKind.ChestEcho){this.player.echoScroll=true;this.echoScrollRooms=3;this.addFloat('奖励：回声卷轴 3间',this.player.pos.add(new Vec2(-20,-42)),'#ffe275');}
  }

  // ── Room clear ──────────────────────────────────────────────
  onRoomCleared(){
    const total=this.correctHits+this.wrongHits;
    const accuracy=total===0?1:this.correctHits/total;
    if(accuracy>=0.8&&this.collisions<=1&&this.roomTime<80){
      this.roomDifficultyScale=Math.min(1.35,this.roomDifficultyScale+0.08);
      this.message='清房漂亮：下一间更有挑战';
    } else if(accuracy<0.5||this.collisions>=4||this.roomTime>100){
      this.roomDifficultyScale=Math.max(0.74,this.roomDifficultyScale-0.12);
      this.player.hp=Math.min(this.player.maxHp,this.player.hp+18);
      this.message='系统降压：下间减少压迫并闪烁正确释义';
    } else {
      this.message='房间清空。按 E 立刻进入下一间。';
    }
    if(new Set(this.runWords.map(w=>w.word)).size>=this.bankWords.length){
      this.state=GameState.Win;this.endScrollOffset=0;
      this.message='词库清空，通关！按 Enter 回到主菜单。';
      this.saveData.bestRoom=Math.max(this.saveData.bestRoom,this.room);
      this.saveData.hasContinue=false;this.save();return;
    }
    this.state=GameState.RoomClear;this.clearDelay=2.2;
    this.saveData.bestRoom=Math.max(this.saveData.bestRoom,this.room);
    this.save();
  }

  addFloat(text, pos, color){
    this.floatingTexts.push(new FloatingText(text, pos.clone(), color));
  }

  scrollEndList(delta){
    const maxScroll=Math.max(0,new Set(this.runWords.map(w=>w.word)).size-16);
    this.endScrollOffset=clamp(this.endScrollOffset+delta,0,maxScroll);
  }

  // ── Save continue state ─────────────────────────────────────
  saveContinueState(){
    if(!this.player) return;
    if(this.state===GameState.Menu||this.state===GameState.GameOver||this.state===GameState.Win) return;
    const sd=this.saveData;
    sd.hasContinue=true;sd.continueMode=this.selectedMode;sd.continueModeName=this.selectedModeName;
    sd.continueRoom=Math.max(1,this.room);sd.continueHp=Math.max(1,this.player.hp);
    sd.continueSpeed=this.player.speed;sd.continueDashCooldown=this.player.dashCooldown;
    sd.continueThrowSpeed=this.player.throwSpeed;sd.continuePickupRange=this.player.pickupRange;
    sd.continueDefense=this.player.defense;sd.continueLuck=this.player.luck;
    sd.continuePiercingInkRooms=this.piercingInkRooms;sd.continueEchoScrollRooms=this.echoScrollRooms;
    sd.continueSpeedBoostRooms=this.speedBoostRooms;sd.continueThrowBoostRooms=this.throwBoostRooms;
    sd.continueDashBoostRooms=this.dashBoostRooms;sd.continuePickupBoostRooms=this.pickupBoostRooms;
    sd.continueTempSpeedBonus=this.tempSpeedBonus;sd.continueTempThrowBonus=this.tempThrowBonus;
    sd.continueTempDashBonus=this.tempDashBonus;sd.continueTempPickupBonus=this.tempPickupBonus;
    this.save();
  }

  // ── Main loop ───────────────────────────────────────────────
  loop(){
    if(this.state===GameState.Playing) this.updatePlaying(DT);
    else if(this.state===GameState.RoomClear){
      this.clearDelay-=DT;this.updatePlayer(DT);this.updateDrops(DT);this.updateFloatingText(DT);
      if(this.clearDelay<=0) this.startRoom();
    }
    this.render();
    requestAnimationFrame(()=>this.loop());
  }

  // =============================================================
  //  RENDERING
  // =============================================================
  render(){
    const ctx=this.ctx;
    const dpr=window.devicePixelRatio||1;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,this.cv.width,this.cv.height);
    ctx.fillStyle='#000';ctx.fillRect(0,0,this.cv.width,this.cv.height);

    ctx.save();
    ctx.translate(this.renderOffsetX,this.renderOffsetY);
    ctx.scale(this.renderScale,this.renderScale);
    ctx.beginPath();ctx.rect(0,0,W,H);ctx.clip();

    if(this.state===GameState.Menu) this.drawMenu(ctx);
    else {
      this.drawGame(ctx);
      if(this.state===GameState.RewardChoice) this.drawRewardChoice(ctx);
      if(this.state===GameState.Paused) this.drawOverlayPanel(ctx,'暂停','按 Esc 继续');
      if(this.state===GameState.GameOver) this.drawEndScreen(ctx,'探险失败');
      if(this.state===GameState.Win) this.drawEndScreen(ctx,'通关结算');
      if(this.showBook&&(this.state===GameState.Playing||this.state===GameState.RoomClear)) this.drawMemoryBook(ctx);
      if(this.state===GameState.Playing||this.state===GameState.RoomClear) this.drawCrosshair(ctx);
    }
    ctx.restore();
  }

  drawGame(ctx){
    const t=THEMES[(this.room-1+THEMES.length)%THEMES.length];
    if(!this.drawThemeBackground(ctx)){
      ctx.fillStyle=t.floor;ctx.fillRect(0,0,W,H);
      ctx.fillStyle=t.wall;
      ctx.fillRect(0,0,W,58);ctx.fillRect(0,H-30,W,30);
      ctx.fillRect(0,0,28,H);ctx.fillRect(W-28,0,28,H);
      this.drawFloorTiles(ctx,t);
    }
    this.drawObstacles(ctx);
    this.drawChests(ctx);
    this.drawMeanings(ctx);
    this.drawDrops(ctx);
    this.drawProjectiles(ctx);
    this.drawEnemyProjectiles(ctx);
    this.drawMonsters(ctx);
    this.drawPlayer(ctx);
    this.drawHud(ctx,t);
    this.drawFloating(ctx);
  }

  drawThemeBackground(ctx){
    const idx=(this.room-1+THEMES.length)%THEMES.length;
    const bg=this.images['bg_'+idx];
    if(!bg) return false;
    ctx.drawImage(bg,0,0,W,H);return true;
  }

  drawFloorTiles(ctx, t){
    // Simplified floor tiles
    ctx.strokeStyle='rgba(255,255,255,0.05)';ctx.lineWidth=1;
    for(let x=28;x<W;x+=64){ctx.beginPath();ctx.moveTo(x,58);ctx.lineTo(x,H-30);ctx.stroke();}
    for(let y=58;y<H;y+=64){ctx.beginPath();ctx.moveTo(28,y);ctx.lineTo(W-28,y);ctx.stroke();}
  }

  drawObstacles(ctx){
    for(const ob of this.obstacles){
      const r=ob.bounds;
      // Shadow
      ctx.fillStyle='rgba(0,0,0,0.15)';
      ctx.beginPath();ctx.ellipse(r.x+r.w/2,r.y+r.h+4,r.w/2-5,6,0,0,Math.PI*2);ctx.fill();

      const img=this.images.obstacles;
      if(img&&this.obstacleSpriteVisible[ob.spriteIndex]){
        const src=this.obstacleSpriteSources[ob.spriteIndex];
        if(src){
          // Aspect fit
          const scale=Math.min(r.w/src.w,r.h/src.h);
          const dw=src.w*scale,dh=src.h*scale;
          const dx=r.x+(r.w-dw)/2,dy=r.y+(r.h-dh)/2;
          ctx.drawImage(img,src.x,src.y,src.w,src.h,dx,dy,dw,dh);
          continue;
        }
      }
      // Fallback: draw colored rectangles
      ctx.fillStyle=ob.fill;ctx.strokeStyle=ob.stroke;ctx.lineWidth=2;
      roundRect(ctx,r.x,r.y,r.w,r.h,6);ctx.fill();ctx.stroke();
    }
  }

  drawPlayer(ctx){
    const aim=this.getAimDirection();
    // Shadow
    const pulse=1+Math.sin(this.walkAnimTime*18)*0.06;
    ctx.fillStyle='rgba(0,0,0,0.2)';
    ctx.beginPath();ctx.ellipse(this.player.pos.x,this.player.pos.y+14,24*pulse,6.5,0,0,Math.PI*2);ctx.fill();

    const p=this.player;
    // Try sprite sheets in order: heroGunActions > heroWalk > heroDirections > characters
    let drawn=false;
    if(this.images.heroGunActions){
      const frame=this.heroActionFrameIndex();
      this.drawAtlasCentered(ctx,'heroGunActions',8,4,this.playerFacing*8+frame,p.pos.x,p.pos.y-14,90,90);
      drawn=true;
    } else if(this.images.heroWalk){
      const frame=this.heroFrameIndex();
      this.drawAtlasCentered(ctx,'heroWalk',6,4,this.playerFacing*6+frame,p.pos.x,p.pos.y-16,88,88);
      drawn=true;
    } else if(this.images.heroDirections){
      this.drawAtlasCentered(ctx,'heroDirections',4,1,this.playerFacing,p.pos.x,p.pos.y-14,84,84);
      drawn=true;
    } else if(this.images.characters){
      this.drawAtlasCentered(ctx,'characters',4,2,0,p.pos.x,p.pos.y-14,84,84);
      drawn=true;
    }
    if(!drawn){
      const bodyColor=p.invulnerable>0?'#ffeea1':'#60c5ff';
      ctx.fillStyle=bodyColor;ctx.strokeStyle='#12222d';ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(p.pos.x,p.pos.y,18,0,Math.PI*2);ctx.fill();ctx.stroke();
      // Aim line
      ctx.strokeStyle='rgba(255,255,255,0.85)';ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(p.pos.x,p.pos.y);
      ctx.lineTo(p.pos.x+aim.x*45,p.pos.y+aim.y*45);ctx.stroke();
    }
    // Shield
    if(p.shieldTime>0){
      ctx.strokeStyle='rgba(128,173,255,0.55)';ctx.lineWidth=4;
      ctx.beginPath();ctx.arc(p.pos.x,p.pos.y,27,0,Math.PI*2);ctx.stroke();
    }
  }

  heroFrameIndex(){
    if(this.dashAnimTime>0) return 5;
    if(this.walkAnimTime<=0.001) return 0;
    return 1+Math.floor(this.walkAnimTime*10)%4;
  }

  heroActionFrameIndex(){
    if(this.fireAnimTime>0) return 6;
    if(this.dashAnimTime>0) return 5;
    if(this.player.invulnerable>0) return 7;
    if(this.walkAnimTime<=0.001) return 0;
    return 1+Math.floor(this.walkAnimTime*10)%4;
  }

  drawMonsters(ctx){
    for(const m of this.monsters){
      const color=MONSTER_COLORS[m.kind]||'#d6535c';
      if(m.rageTimer>0) ctx.fillStyle='#ff4848';else ctx.fillStyle=color;

      // Shadow
      ctx.fillStyle='rgba(0,0,0,0.2)';
      ctx.beginPath();ctx.ellipse(m.pos.x,m.pos.y+m.radius-4,m.radius,6,0,0,Math.PI*2);ctx.fill();

      const spriteIdx=MONSTER_SPRITES[m.kind]||1;
      if(this.images.characters){
        const spriteSize=m.radius*2.6;
        this.drawAtlasCentered(ctx,'characters',4,2,
          this.isEliteMonster(m)?6:spriteIdx,
          m.pos.x,m.pos.y-4,spriteSize*1.22,spriteSize,!m.facingRight);
      } else {
        ctx.fillStyle=m.rageTimer>0?'#ff4848':color;ctx.strokeStyle='#16161a';ctx.lineWidth=3;
        ctx.beginPath();ctx.arc(m.pos.x,m.pos.y,m.radius,0,Math.PI*2);ctx.fill();ctx.stroke();
      }
      // Shield
      if(m.shieldUp){
        ctx.strokeStyle='rgba(172,224,255,0.75)';ctx.lineWidth=4;
        ctx.beginPath();ctx.arc(m.pos.x,m.pos.y,m.radius+7,0,Math.PI*2);ctx.stroke();
      }
      // Elite ring
      if(this.isEliteMonster(m)){
        ctx.strokeStyle='rgba(255,188,112,0.6)';ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(m.pos.x,m.pos.y,m.radius+12,0,Math.PI*2);ctx.stroke();
      }
      // Word text
      this.drawOutlinedText(ctx,m.entry.word,m.pos.x,m.pos.y-12,'#fff084','#121218');
      // HP bar
      this.drawHpBar(ctx,m.pos.x-28,m.pos.y+m.radius+9,56,5,m.hp/m.maxHp,'#ffde76');
    }
  }

  drawMeanings(ctx){
    for(const token of this.meanings){
      const bounds=this.meaningTokenBounds(token.meaning,token.pos);
      let fill='rgba(229,170,82,0.88)';
      if(token.glowTimer>0&&Math.floor(this.roomTime*5)%2===0) fill='rgba(158,244,145,0.94)';
      ctx.fillStyle=fill;ctx.strokeStyle='rgba(40,24,0,0.5)';ctx.lineWidth=2;
      roundRect(ctx,bounds.x,bounds.y,bounds.w,bounds.h,7);ctx.fill();ctx.stroke();
      ctx.fillStyle='rgba(42,35,23)';
      ctx.font='bold 16px "Microsoft YaHei","PingFang SC",sans-serif';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(token.meaning,token.pos.x,token.pos.y);
    }
    ctx.textAlign='start';ctx.textBaseline='alphabetic';
  }

  drawProjectiles(ctx){
    for(const p of this.projectiles){
      const color=p.universal?'rgba(165,226,255,0.9)':'rgba(246,241,174,0.9)';
      ctx.fillStyle=color;ctx.strokeStyle='rgba(66,20,0,0.5)';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(p.pos.x,p.pos.y,9,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle='#fff';ctx.font='bold 11px sans-serif';ctx.textAlign='center';
      ctx.fillText(p.universal?'回声':p.meaning,p.pos.x,p.pos.y-13);
    }
    ctx.textAlign='start';
  }

  drawEnemyProjectiles(ctx){
    for(const b of this.enemyProjectiles){
      ctx.fillStyle='rgba(255,96,64,0.3)';
      ctx.beginPath();ctx.arc(b.pos.x,b.pos.y,13,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#ff764e';ctx.strokeStyle='#5c2018';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(b.pos.x,b.pos.y,7,0,Math.PI*2);ctx.fill();ctx.stroke();
    }
  }

  drawDrops(ctx){
    for(const d of this.drops){
      const colors=['#8ee680','#ca8f55','#68c5f4','#a47eea','#71cfe5','#edecdc','#ebb75b'];
      ctx.fillStyle=colors[d.kind]||'#8ee680';ctx.strokeStyle='rgba(35,28,0,0.5)';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(d.pos.x,d.pos.y,12,0,Math.PI*2);ctx.fill();ctx.stroke();
    }
  }

  drawChests(ctx){
    for(const c of this.chests){
      if(c.opened) continue;
      ctx.fillStyle='#af703e';ctx.strokeStyle='#362317';ctx.lineWidth=3;
      ctx.fillRect(c.pos.x-22,c.pos.y-18,44,36);
      ctx.strokeRect(c.pos.x-22,c.pos.y-18,44,36);
      ctx.beginPath();ctx.moveTo(c.pos.x-22,c.pos.y-2);ctx.lineTo(c.pos.x+22,c.pos.y-2);ctx.stroke();
      ctx.fillStyle='#f4cd56';ctx.fillRect(c.pos.x-5,c.pos.y-1,10,9);
    }
  }

  drawHud(ctx, t){
    // Header bg
    ctx.fillStyle='rgba(16,20,25,0.77)';ctx.fillRect(0,0,W,58);
    // HP bar
    this.drawHpBar(ctx,24,18,180,16,this.player.hp/this.player.maxHp,'#69e280');
    ctx.fillStyle='#fff';ctx.font='12px "Microsoft YaHei",sans-serif';
    ctx.textAlign='start';
    ctx.fillText('HP '+Math.max(0,Math.floor(this.player.hp))+'/'+Math.floor(this.player.maxHp),32,30);
    ctx.fillText('房间 '+this.room+' · '+THEMES[(this.room-1)%THEMES.length].name+' · '+this.selectedModeName,225,30);
    ctx.fillText('连击 '+this.combo+'  命中率 '+this.accuracyText(),560,30);
    ctx.font='bold 16px "Microsoft YaHei",sans-serif';
    ctx.fillText('持有：'+(this.player.heldMeaning.length===0?'无':this.player.heldMeaning),760,30);
    ctx.font='12px sans-serif';
    const distinctWords=new Set(this.runWords.map(w=>w.word)).size;
    ctx.fillText('已见词 '+distinctWords+'/'+this.bankWords.length,1080,30);
    // Bottom message
    if(this.message.length>0){
      ctx.fillStyle='rgba(224,235,241,0.9)';ctx.font='12px sans-serif';
      ctx.fillText(this.message,34,H-8);
    }
    // Cooldowns
    this.drawMiniMeter(ctx,1010,15,'闪避',1-clamp01(this.player.dashTimer/this.player.dashCooldown),'#7bd2fc');
    this.drawMiniMeter(ctx,1088,15,'护盾',clamp01(this.player.shieldTime/10),'#8ec3ff');
  }

  drawMiniMeter(ctx,x,y,label,value,color){
    ctx.strokeStyle='rgba(255,255,255,0.35)';ctx.lineWidth=1;
    ctx.strokeRect(x,y,56,10);
    ctx.fillStyle='rgba(255,255,255,0.12)';ctx.fillRect(x,y,56,10);
    ctx.fillStyle=color;ctx.fillRect(x,y,56*value,10);
    ctx.fillStyle='#fff';ctx.font='11px sans-serif';ctx.textAlign='start';
    ctx.fillText(label,x,y+22);
  }

  drawFloating(ctx){
    for(const ft of this.floatingTexts){
      const alpha=clamp01(ft.life/1.35);
      ctx.globalAlpha=alpha;
      ctx.fillStyle=ft.color;ctx.font='12px "Microsoft YaHei",sans-serif';
      ctx.textAlign='start';ctx.fillText(ft.text,ft.pos.x,ft.pos.y);
    }
    ctx.globalAlpha=1;
  }

  drawCrosshair(ctx){
    const x=this.mouse.x,y=this.mouse.y;

    // Mobile: show aim line from player to touch point when aiming
    if(this.touchAimId !== null && this.player){
      const px=this.player.pos.x, py=this.player.pos.y;
      const dir=this.mouse.sub(this.player.pos).norm();
      const lineLen=120;
      const ex=px+dir.x*lineLen, ey=py+dir.y*lineLen;
      // Dashed aim line
      ctx.save();
      ctx.strokeStyle='rgba(255,232,128,0.6)';ctx.lineWidth=2;
      ctx.setLineDash([6,4]);
      ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(ex,ey);ctx.stroke();
      ctx.setLineDash([]);
      // Arrow head
      const arrowSize=8;
      const angle=Math.atan2(ey-py,ex-px);
      ctx.fillStyle='rgba(255,232,128,0.7)';
      ctx.beginPath();
      ctx.moveTo(ex,ey);
      ctx.lineTo(ex-arrowSize*Math.cos(angle-0.4),ey-arrowSize*Math.sin(angle-0.4));
      ctx.lineTo(ex-arrowSize*Math.cos(angle+0.4),ey-arrowSize*Math.sin(angle+0.4));
      ctx.closePath();ctx.fill();
      ctx.restore();
    }

    ctx.strokeStyle='rgba(20,24,28,0.9)';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x-14,y);ctx.lineTo(x-10,y);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+10,y);ctx.lineTo(x+14,y);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x,y-14);ctx.lineTo(x,y-10);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x,y+10);ctx.lineTo(x,y+14);ctx.stroke();
    ctx.strokeStyle='rgba(255,232,128,0.95)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x-14,y);ctx.lineTo(x-10,y);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+10,y);ctx.lineTo(x+14,y);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x,y-14);ctx.lineTo(x,y-10);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x,y+10);ctx.lineTo(x,y+14);ctx.stroke();
  }

  drawOutlinedText(ctx,text,x,y,fill,outline){
    ctx.font='bold 16px "Segoe UI","Microsoft YaHei",sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle=outline;
    ctx.fillText(text,x-1,y);ctx.fillText(text,x+1,y);
    ctx.fillText(text,x,y-1);ctx.fillText(text,x,y+1);
    ctx.fillStyle=fill;ctx.fillText(text,x,y);
    ctx.textAlign='start';ctx.textBaseline='alphabetic';
  }

  drawHpBar(ctx,x,y,w,h,value,color){
    value=clamp01(value);
    ctx.fillStyle='rgba(0,0,0,0.35)';ctx.fillRect(x,y,w,h);
    ctx.fillStyle=color;ctx.fillRect(x,y,w*value,h);
  }

  accuracyText(){
    const total=this.correctHits+this.wrongHits;
    if(total===0) return '100%';
    return Math.floor(this.correctHits*100/total)+'%';
  }

  // ── Menu drawing ────────────────────────────────────────────
  drawMenu(ctx){
    ctx.fillStyle='#12161c';ctx.fillRect(0,0,W,H);
    // Grid bg
    ctx.strokeStyle='rgba(255,255,255,0.03)';ctx.lineWidth=1;
    for(let x=0;x<W;x+=74){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<H;y+=74){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    // Preview monsters
    this.drawPreviewMonster(ctx,134,528,'increase','rgb(210,83,92)');
    this.drawPreviewMonster(ctx,1060,196,'strategy','rgb(232,117,79)');
    this.drawPreviewMonster(ctx,990,548,'curious','rgb(174,111,214)');
    this.drawPreviewToken(ctx,216,184,'增加');
    this.drawPreviewToken(ctx,960,392,'策略');
    this.drawPreviewToken(ctx,404,520,'好奇的');
    // Title
    ctx.fillStyle='#fff';ctx.font='bold 40px "Microsoft YaHei",sans-serif';ctx.textAlign='center';
    ctx.fillText('词域探险',W/2,100);
    ctx.fillStyle='#c7d6e0';ctx.font='16px "Microsoft YaHei",sans-serif';
    ctx.fillText('选择词库难度，然后开始一局单词地牢探险',W/2,150);
    ctx.textAlign='start';

    // Difficulty buttons
    this.drawDifficultyButton(ctx,0,'小学','PEP词汇','人教版小学英语，基础入门',1);
    this.drawDifficultyButton(ctx,1,'初中','高中词汇','基础词优先，怪物压力较低',3);
    this.drawDifficultyButton(ctx,2,'普通','四六级词汇','更高词汇难度，房间推进更快',5);
    this.drawDifficultyButton(ctx,3,'困难','雅思词汇','高阶词、精英怪和动态压力更明显',7);

    // Start button
    const sr=this.menuStartRect();
    const hoverS=ptInRect(this.mouse,sr);
    ctx.fillStyle=hoverS?'#ecca67':'#deb248';ctx.strokeStyle='#4c3214';ctx.lineWidth=2;
    roundRect(ctx,sr.x,sr.y,sr.w,sr.h,8);ctx.fill();ctx.stroke();
    ctx.fillStyle='#231d12';ctx.font='bold 40px "Microsoft YaHei",sans-serif';ctx.textAlign='center';
    ctx.fillText('开始新游戏',W/2,sr.y+sr.h/2+12);

    // Continue button
    const cr=this.menuContinueRect();
    const enabled=this.saveData.hasContinue;
    const hoverC=enabled&&ptInRect(this.mouse,cr);
    ctx.fillStyle=enabled?(hoverC?'#5f9dc7':'#437ba4'):'#3a4148';
    ctx.strokeStyle=enabled?'#9ad4f5':'#586068';ctx.lineWidth=2;
    roundRect(ctx,cr.x,cr.y,cr.w,cr.h,8);ctx.fill();ctx.stroke();
    ctx.fillStyle=enabled?'#fff':'#96a0a8';ctx.font='bold 18px "Microsoft YaHei",sans-serif';
    ctx.fillText(enabled?'继续游戏：第 '+this.saveData.continueRoom+' 间':'继续游戏',W/2,cr.y+cr.h/2+6);

    // Hints
    ctx.fillStyle='#b0bec9';ctx.font='12px sans-serif';
    ctx.fillText('快捷键：1/2/3/4 选择难度，Enter 开始，F11 全屏',W/2-220,612);
    ctx.fillText('游戏内：WASD 移动  鼠标瞄准  左键发射  E 拾取  Space 闪避',W/2-260,642);
    ctx.textAlign='start';
  }

  drawDifficultyButton(ctx,index,title,subtitle,description,maxDiff){
    const r=this.menuDifficultyRect(index);
    const selected=this.selectedMode===maxDiff;
    const hover=ptInRect(this.mouse,r);
    ctx.fillStyle=selected?'rgb(63,102,82)':hover?'#2f3946':'#252d38';
    ctx.strokeStyle=selected?'#91e792':'#556374';ctx.lineWidth=selected?3:1;
    roundRect(ctx,r.x,r.y,r.w,r.h,8);ctx.fill();ctx.stroke();
    ctx.textAlign='center';
    ctx.fillStyle='#fff';ctx.font='bold 27px "Microsoft YaHei",sans-serif';
    ctx.fillText(title,r.x+r.w/2,r.y+44);
    ctx.fillStyle=selected?'#c0f6b9':'#e1e8ee';ctx.font='bold 16px "Microsoft YaHei",sans-serif';
    ctx.fillText(subtitle,r.x+r.w/2,r.y+86);
    ctx.fillStyle='#b5c2cc';ctx.font='12px sans-serif';
    ctx.fillText(description,r.x+r.w/2,r.y+120);
    ctx.textAlign='start';
  }

  drawPreviewMonster(ctx,x,y,word,color){
    ctx.fillStyle='rgba(0,0,0,0.3)';
    ctx.beginPath();ctx.ellipse(x,y+30,38,8,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=color.replace('rgb','rgba').replace(')',',0.6)');
    ctx.strokeStyle='rgba(20,24,32,0.3)';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(x,y,42,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.82)';ctx.font='bold 16px "Segoe UI",sans-serif';
    ctx.textAlign='center';ctx.fillText(word,x,y+5);
    ctx.textAlign='start';
  }

  drawPreviewToken(ctx,x,y,text){
    ctx.font='bold 16px "Microsoft YaHei",sans-serif';
    const tw=ctx.measureText(text).width;
    ctx.fillStyle='rgba(229,170,82,0.62)';ctx.strokeStyle='rgba(50,32,0,0.5)';ctx.lineWidth=2;
    roundRect(ctx,x-tw/2-14,y-16,tw+28,32,7);ctx.fill();ctx.stroke();
    ctx.fillStyle='rgba(42,35,23,0.85)';ctx.textAlign='center';ctx.fillText(text,x,y+5);
    ctx.textAlign='start';
  }

  // ── Reward choice screen ────────────────────────────────────
  drawRewardChoice(ctx){
    ctx.fillStyle='rgba(9,13,19,0.67)';ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='bold 40px "Microsoft YaHei",sans-serif';
    ctx.fillText('房间补给',W/2,138);
    ctx.fillStyle='#d8e2eb';ctx.font='16px "Microsoft YaHei",sans-serif';
    ctx.fillText('选择一张奖励卡，然后开始第 '+this.room+' 间',W/2,188);
    ctx.fillStyle='#b2beca';ctx.font='12px sans-serif';
    ctx.fillText('快捷键 1 / 2 / 3',W/2,218);
    ctx.textAlign='start';
    for(let i=0;i<this.rewardCards.length;i++) this.drawRewardCard(ctx,this.rewardCards[i],this.rewardCardRect(i),i+1);
  }

  drawRewardCard(ctx,card,rect,number){
    let accent='#74c9ff';
    if(card.kind===RewardKind.Survival) accent='#7ee597';
    else if(card.kind===RewardKind.MoveSpeed||card.kind===RewardKind.Shield) accent='#7dbdff';
    else accent='#ffd369';

    ctx.fillStyle='rgba(28,34,43,0.93)';ctx.strokeStyle=accent;ctx.lineWidth=2;
    roundRect(ctx,rect.x,rect.y,rect.w,rect.h,8);ctx.fill();ctx.stroke();

    // Badge
    ctx.fillStyle=accent;
    roundRect(ctx,rect.x+18,rect.y+18,42,34,7);ctx.fill();
    ctx.fillStyle='#181c22';ctx.font='bold 16px "Microsoft YaHei",sans-serif';ctx.textAlign='center';
    ctx.fillText(number.toString(),rect.x+39,rect.y+40);

    ctx.textAlign='start';
    ctx.fillStyle=accent;ctx.font='12px sans-serif';
    ctx.fillText(card.category,rect.x+76,rect.y+38);
    ctx.fillStyle='#fff';ctx.font='bold 27px "Microsoft YaHei",sans-serif';
    ctx.fillText(card.title,rect.x+22,rect.y+100);
    ctx.fillStyle='#cad6e0';ctx.font='16px "Microsoft YaHei",sans-serif';
    ctx.fillText(card.description,rect.x+22,rect.y+142,rect.w-44);
    ctx.fillStyle=accent;ctx.font='16px "Microsoft YaHei",sans-serif';ctx.textAlign='center';
    ctx.fillText('选择',rect.x+rect.w/2,rect.y+rect.h-28);
    ctx.textAlign='start';
  }

  // ── End screen ──────────────────────────────────────────────
  drawEndScreen(ctx,title){
    const endWords=[...new Map(this.runWords.map(w=>[w.word,w])).values()];
    ctx.fillStyle='rgba(12,15,21,0.82)';ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='bold 40px "Microsoft YaHei",sans-serif';
    ctx.fillText(title,W/2,76);
    ctx.fillStyle='#cddaec';ctx.font='16px "Microsoft YaHei",sans-serif';
    ctx.fillText(this.message,W/2,126);

    const listRect={x:150,y:150,w:980,h:500};
    ctx.fillStyle='rgba(31,37,46,0.92)';
    roundRect(ctx,listRect.x,listRect.y,listRect.w,listRect.h,8);ctx.fill();

    ctx.fillStyle='#f6f7f8';ctx.font='bold 16px "Microsoft YaHei",sans-serif';
    ctx.textAlign='start';
    ctx.fillText('本局词汇回顾  '+endWords.length+' 词',listRect.x+26,listRect.y+34);
    ctx.fillStyle='#b2beca';ctx.font='12px sans-serif';
    ctx.fillText('滚轮/↑↓滚动，Enter 返回主菜单',listRect.x+26,listRect.y+56);

    const clipY=listRect.y+74, clipH=listRect.height-96;
    ctx.save();ctx.beginPath();ctx.rect(listRect.x+26,clipY,listRect.w-74,clipH);ctx.clip();
    let rowY=clipY;
    for(const w of endWords.slice(this.endScrollOffset,this.endScrollOffset+16)){
      ctx.fillStyle='#d1e1e8';ctx.font='bold 16px "Segoe UI",sans-serif';
      ctx.fillText(w.word.padEnd(16),listRect.x+34,rowY);
      ctx.font='bold 16px "Microsoft YaHei",sans-serif';
      ctx.fillText(w.meaning,listRect.x+250,rowY);
      ctx.font='12px sans-serif';
      ctx.fillText('正确 '+w.correctCount+' / 错误 '+w.wrongCount+' / 死亡复现 '+w.deathCount,listRect.x+496,rowY);
      rowY+=25;
    }
    ctx.restore();
    ctx.textAlign='start';
  }

  drawMemoryBook(ctx){
    const panel={x:190,y:86,w:900,h:540};
    ctx.fillStyle='rgba(24,29,36,0.92)';ctx.strokeStyle='rgba(212,224,232,0.47)';ctx.lineWidth=1;
    roundRect(ctx,panel.x,panel.y,panel.w,panel.h,8);ctx.fill();ctx.stroke();
    ctx.fillStyle='#fff';ctx.font='bold 27px "Microsoft YaHei",sans-serif';
    ctx.fillText('记忆书 - 本局出现词汇',panel.x+28,panel.y+48);
    const distinct=[...new Map(this.runWords.map(w=>[w.word,w])).values()];
    let y=panel.y+86;
    ctx.font='16px "Microsoft YaHei",sans-serif';
    for(const w of distinct.slice(0,16)){
      ctx.fillStyle=w.correctCount>w.wrongCount?'#aaf5b9':'#ffde8a';
      ctx.fillText(w.word.padEnd(16)+'  =  '+w.meaning+'   正确 '+w.correctCount+'  错误 '+w.wrongCount+'  掌握 '+w.mastery,panel.x+36,y);
      y+=28;
    }
  }

  drawOverlayPanel(ctx,title,body){
    const panel={x:W/2-220,y:H/2-105,w:440,h:210};
    ctx.fillStyle='rgba(20,25,32,0.88)';ctx.strokeStyle='rgba(220,230,240,0.47)';ctx.lineWidth=1;
    roundRect(ctx,panel.x,panel.y,panel.w,panel.h,8);ctx.fill();ctx.stroke();
    ctx.fillStyle='#fff';ctx.font='bold 40px "Microsoft YaHei",sans-serif';ctx.textAlign='center';
    ctx.fillText(title,W/2,panel.y+64);
    ctx.font='16px "Microsoft YaHei",sans-serif';
    ctx.fillText(body,W/2,panel.y+138);
    ctx.textAlign='start';
  }
}

// ── Utility functions ─────────────────────────────────────────
function clamp(v,min,max){return v<min?min:v>max?max:v;}
function clamp01(v){return clamp(v,0,1);}

function ptInRect(p, r){
  return p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;
}

function rectsOverlap(a,b){
  return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
}

function inflateRect(r,ix,iy){
  return {x:r.x-ix,y:r.y-iy,w:r.w+ix*2,h:r.h+iy*2};
}

function circleIntersectsRect(center, radius, rect){
  const closestX=clamp(center.x,rect.x,rect.x+rect.w);
  const closestY=clamp(center.y,rect.y,rect.y+rect.h);
  const dx=center.x-closestX, dy=center.y-closestY;
  return dx*dx+dy*dy<=radius*radius;
}

function obstacleCollisionBounds(ob){
  const b=ob.bounds;
  const insetX=Math.min(6,b.w*0.05);
  const insetY=Math.min(6,b.h*0.05);
  return {x:b.x+insetX,y:b.y+insetY,w:b.w-insetX*2,h:b.h-insetY*2};
}

function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);
  ctx.closePath();
}

// ── Start game ────────────────────────────────────────────────
const canvas = document.getElementById('gc');
const game = new Game(canvas);
