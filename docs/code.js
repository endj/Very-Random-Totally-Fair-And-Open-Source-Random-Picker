let CONFIG = {
    userListRenderLimit: 25,
    baseVelocity: 10,
    randomVelocity: 2,
};
const SOUND = {
    applause: new Audio("assets/a.wav")
};
class RGB {
    constructor(r, g, b) {
        this.asString = () => {
            return `rgb(${this.r},${this.g},${this.b})`;
        };
        this.r = r;
        this.g = g;
        this.b = b;
    }
}
class PixelImage {
    constructor(name, sourcePath, height, width) {
        this.name = name;
        this.height = height;
        this.width = width;
        let image = new Image();
        image.src = sourcePath;
        this.imgData = image;
    }
}
var ImageNames;
(function (ImageNames) {
    ImageNames[ImageNames["TELEPORT"] = 0] = "TELEPORT";
    ImageNames[ImageNames["DUPLICATE"] = 1] = "DUPLICATE";
    ImageNames[ImageNames["GRAVITY"] = 2] = "GRAVITY";
})(ImageNames || (ImageNames = {}));
class Images {
}
Images.images = new Map([
    [ImageNames.DUPLICATE, new PixelImage(ImageNames.DUPLICATE, "assets/duplicate.png", 48, 48)],
    [ImageNames.TELEPORT, new PixelImage(ImageNames.TELEPORT, "assets/teleport.png", 48, 48)],
    [ImageNames.GRAVITY, new PixelImage(ImageNames.GRAVITY, "assets/blackhole.png", 48, 48)]
]);
Images.getImage = (name) => Images.images.get(name);
class Maths {
}
Maths.hashCache = new Map();
Maths.coinflip = () => Math.random() > 0.5;
Maths.distance = (x1, y1, x2, y2) => Math.sqrt(Math.pow((x1 - x2), 2) + Math.pow((y1 - y2), 2));
Maths.normalize = (val, min, max, range) => (val - min) / ((max - min) * range);
Maths.hashString = (text) => {
    const cachedHash = Maths.hashCache.get(text);
    if (cachedHash) {
        return cachedHash;
    }
    let hash = 0x811c9dc5;
    for (let i = 0, l = text.length; i < l; i++) {
        hash ^= text.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    Maths.hashCache.set(text, hash >>> 0);
    return hash >>> 0;
};
Maths.numberToColour = (num) => {
    num >>>= 0;
    return new RGB(num & 0xFF, (num & 0xFF00) >>> 8, (num & 0xFF0000) >>> 16);
};
class Target {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}
class Point {
    constructor(name, x, y, dx, dy, velocity) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.velocity = velocity;
        this.colour = Maths.numberToColour(Maths.hashString(name));
    }
}
Point.pointRenderSize = 2;
var EffectNames;
(function (EffectNames) {
    EffectNames[EffectNames["TELEPORT"] = 0] = "TELEPORT";
    EffectNames[EffectNames["DUPLICATE"] = 1] = "DUPLICATE";
    EffectNames[EffectNames["GRAVITY"] = 2] = "GRAVITY";
})(EffectNames || (EffectNames = {}));
class EffectFunctions {
}
EffectFunctions.coinflip = () => Math.random() > 0.5;
EffectFunctions.effects = new Map([
    [EffectNames.DUPLICATE,
        function* duplicate(context, p) {
            for (let i = 0; i < 2; i++) {
                const dx = Math.random();
                const dy = Math.random();
                context.state.positions.push(new Point(p.name, p.x, p.y, Maths.coinflip() ? dx : -dx, Maths.coinflip() ? dy : -dy, p.velocity));
            }
            yield false;
        }
    ],
    [EffectNames.TELEPORT,
        function* teleport(context, p) {
            let [x, y] = context.state.safeRandomLocation();
            context.state.target = new Target(x, y);
            yield false;
        }
    ],
    [EffectNames.GRAVITY,
        function* gravity(context, p) {
            const maxSize = 60;
            const tickPerSec = 60;
            const [x, y] = [p.x, p.y];
            const canvasContext = context.renderer.context;
            const applyForce = (p, size) => {
                let dx = Math.abs(p.x - x);
                let dy = Math.abs(p.y - y);
                let normX = Maths.normalize(dx, 0, context.renderer.W, 300) * size;
                let normY = Maths.normalize(dy, 0, context.renderer.H, 300) * size;
                p.dx = p.x > x ? p.dx - normX : p.dx + normX;
                p.dy = p.y > y ? p.dy - normY : p.dy + normY;
            };
            const drawCircle = (size) => {
                canvasContext.beginPath();
                canvasContext.arc(x, y, size, 0, 2 * Math.PI);
                canvasContext.fill();
            };
            for (let i = 0; i < tickPerSec * 4; i++) {
                const blackHoleSize = Math.min(i * 0.4, maxSize);
                drawCircle(blackHoleSize);
                context.state.positions.forEach(p => {
                    applyForce(p, blackHoleSize);
                });
                yield true;
            }
            for (let i = tickPerSec * 2; i > 0; i--) {
                const blackHoleSize = Math.min(i, maxSize);
                drawCircle(blackHoleSize);
                context.state.positions.forEach(p => {
                    applyForce(p, blackHoleSize);
                });
                yield true;
            }
            yield false;
        }
    ]
]);
EffectFunctions.getFunction = (effectName) => EffectFunctions.effects.get(effectName);
class Pickups {
    constructor(img, x, y, appliedEffect) {
        this.img = img;
        this.x = x;
        this.y = y;
        this.id = Math.random();
        this.appliedEffect = appliedEffect;
    }
}
class EffectsRepository {
}
EffectsRepository.effects = new Map([
    [EffectNames.DUPLICATE,
        new Pickups(Images.getImage(ImageNames.DUPLICATE), 0, 0, EffectFunctions.getFunction(EffectNames.DUPLICATE))],
    [EffectNames.TELEPORT,
        new Pickups(Images.getImage(ImageNames.TELEPORT), 0, 0, EffectFunctions.getFunction(EffectNames.TELEPORT))],
    [EffectNames.GRAVITY,
        new Pickups(Images.getImage(ImageNames.GRAVITY), 0, 0, EffectFunctions.getFunction(EffectNames.GRAVITY))]
]);
EffectsRepository.getEffect = (name) => EffectsRepository.effects.get(name);
EffectsRepository.createEffect = (name) => {
    const effect = EffectsRepository.getEffect(name);
    return new Pickups(effect.img, effect.x, effect.y, effect.appliedEffect);
};
class Score {
    constructor(score, point) {
        this.score = score;
        this.point = point;
    }
}
class RenderSize {
    constructor(width, height) {
        this.width = width;
        this.height = height;
    }
}
class State {
    constructor(renderConstraints, onCompletion) {
        this.running = false;
        this.positions = [];
        this.pickups = [];
        this.effects = [];
        this.target = new Target(0, 0);
        this.coinflip = () => Math.random() > 0.5;
        this.initializeEffects = () => {
            const numOfEffects = Math.min(5, this.positions.length);
            this.pickups.push(this.effectWithRandomLocation(EffectNames.DUPLICATE));
            this.pickups.push(this.effectWithRandomLocation(EffectNames.TELEPORT));
            this.pickups.push(this.effectWithRandomLocation(EffectNames.GRAVITY));
            for (let i = 0; i < numOfEffects; i++) {
                this.pickups.push(this.randomEffectAndLocation());
            }
        };
        this.randomEffectAndLocation = () => {
            let choices = [EffectNames.DUPLICATE, EffectNames.TELEPORT];
            return this.effectWithRandomLocation(choices[Math.floor((Math.random()) * choices.length)]);
        };
        this.effectWithRandomLocation = (effect) => {
            const e = EffectsRepository.createEffect(effect);
            let [x, y] = this.safeRandomLocation();
            e.x = x;
            e.y = y;
            return e;
        };
        this.initializeTarget = () => {
            let [x, y] = this.safeRandomLocation();
            this.target = new Target(x, y);
        };
        this.safeRandomLocation = () => {
            let W = this.renderConstraints.width;
            let H = this.renderConstraints.height;
            return [Math.floor(100 + Math.random() * (W - 200)), Math.floor(100 + Math.random() * (H - 200))];
        };
        this.updatePoint = (p) => {
            let W = this.renderConstraints.width;
            let H = this.renderConstraints.height;
            if (p.x > W) {
                p.dx = p.dx > 0 ? -p.dx : p.dx;
            }
            if (p.x < 0) {
                p.dx = p.dx > 0 ? p.dx : -p.dx;
            }
            if (p.y > H) {
                p.dy = p.dy > 0 ? -p.dy : p.dy;
            }
            if (p.y < 0) {
                p.dy = p.dy > 0 ? p.dy : -p.dy;
            }
            p.x = p.x + (p.dx * p.velocity) % W;
            p.y = p.y + (p.dy * p.velocity) % H;
            if (p.velocity !== 0) {
                p.velocity = Math.abs(p.velocity - 0.01) > 0.1 ? p.velocity - 0.01 : 0;
            }
        };
        this.renderConstraints = renderConstraints;
        this.onCompletion = onCompletion;
    }
    initializePoints(users) {
        let W = this.renderConstraints.width;
        let H = this.renderConstraints.height;
        this.positions = [...users].map((name) => {
            const dx = Math.random();
            const dy = Math.random();
            return new Point(name, Math.floor(W / 2 + (this.coinflip() ? -Math.random() * W / 8 : Math.random() * W / 8)), Math.floor(H / 2 + (this.coinflip() ? -Math.random() * H / 8 : Math.random() * H / 8)), this.coinflip() ? dx : -dx, this.coinflip() ? dy : -dy, CONFIG.baseVelocity + Math.random() * CONFIG.randomVelocity);
        });
    }
}
State.isMobile = !!/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
class RenderConfig {
    constructor(maxRenderElements, renderNames, userListRenderLimit) {
        this.maxRenderElements = maxRenderElements;
        this.renderNames = renderNames;
        this.userListRenderLimit = userListRenderLimit;
    }
}
class CanvasRenderer {
    constructor(canvas, config) {
        this.clear = () => {
            this.context.fillStyle = 'white';
            this.context.fillRect(0, 0, this.W, this.H);
            this.context.strokeStyle = 'black';
            this.context.fillStyle = "black";
        };
        this.drawPoint = (point) => {
            this.context.fillRect(point.x, point.y, Point.pointRenderSize, Point.pointRenderSize);
            if (this.config.renderNames) {
                this.context.fillStyle = point.colour.asString();
                this.context.strokeStyle = 'black';
                this.context.fillText(point.name, point.x + 10, point.y + 10);
                this.context.strokeText(point.name, point.x + 10, point.y + 10);
                this.context.fillStyle = 'black';
            }
        };
        this.drawWinnerLines = (scores, target) => {
            const c = this.context;
            const colors = ["red", "yellow", "green"];
            scores.forEach(score => {
                const [x, y] = [score.point.x + Point.pointRenderSize / 2, score.point.y + Point.pointRenderSize / 2];
                c.strokeStyle = colors.pop();
                c.beginPath();
                c.moveTo(x, y);
                c.lineTo(target.x, target.y);
                c.stroke();
            });
            c.strokeStyle = "black";
        };
        this.drawEffect = (effect) => {
            this.context.drawImage(effect.img.imgData, effect.x, effect.y);
        };
        this.drawTarget = (target) => {
            const c = this.context;
            const orig = c.lineWidth;
            c.lineWidth = 10;
            c.strokeStyle = "red";
            c.beginPath();
            c.moveTo(target.x - 10, target.y - 10);
            c.lineTo(target.x + 10, target.y + 10);
            c.stroke();
            c.beginPath();
            c.moveTo(target.x - 10, target.y + 10);
            c.lineTo(target.x + 10, target.y - 10);
            c.stroke();
            c.lineWidth = orig;
        };
        this.drawImage = (image, x, y) => {
            this.context.drawImage(image.imgData, x, y, image.width, image.height);
        };
        this.canvas = canvas;
        this.W = canvas.width;
        this.H = canvas.height;
        this.context = canvas.getContext('2d', { alpha: false });
        this.context.font = '30px Arial';
        this.config = config;
    }
}
class Toast {
}
Toast.toast = (message) => Toast.toastWithDuration(message, 3000);
Toast.toastWithDuration = (message, duration) => {
    try {
        const container = ui.create("div");
        container.classList.add("toast");
        const text = ui.create("div");
        text.innerHTML = message;
        container.appendChild(text);
        document.body.appendChild(container);
        setTimeout(() => { container.classList.add("fadein"); }, 500);
        setTimeout(() => {
            container.classList.remove("fadein");
            container.classList.add("toast", "fadeout");
        }, 500 + duration);
        setTimeout(() => { document.body.removeChild(container); }, 500 + duration + 1000);
    }
    catch (e) {
        console.error(e);
    }
};
class UI {
    constructor() {
        this.get = (id) => document.getElementById(id);
        this.create = (type) => document.createElement(type);
        this.userSet = new Set();
        this.input = this.get('in');
        this.users = this.get('users');
        this.savePresetToStorage = (name) => {
            if (this.userSet.size > 0) {
                const storage = Persistance.loadStorage() || {};
                storage[name] = [...this.userSet];
                Persistance.saveStorage(storage);
            }
        };
        this.saveToPreset = () => {
            const name = prompt("Name of preset");
            if (name && this.userSet.size > 0) {
                this.savePresetToStorage(name);
                Toast.toast("Created preset " + name);
                this.populatePresetList();
            }
            else {
                Toast.toast("Creating preset requires at least 1 name");
            }
        };
        this.render = () => {
            ui.get('users').innerHTML = '';
            let renderedUsers = Math.min(CONFIG.userListRenderLimit, this.userSet.size);
            for (let user of this.userSet) {
                this.addUserToList(user);
                if (renderedUsers-- === 0) {
                    this.addUserListContinuation(this.userSet.size - CONFIG.userListRenderLimit);
                    break;
                }
            }
        };
        this.addUserToList = (name) => {
            const item = ui.create('li');
            const userName = ui.create('span');
            const removeUserButton = ui.create('button');
            removeUserButton.textContent = "-";
            removeUserButton.addEventListener('click', () => this.remove(name));
            userName.textContent = name;
            item.classList.add('name');
            item.appendChild(userName);
            item.appendChild(removeUserButton);
            this.users.appendChild(item);
        };
        this.addUserListContinuation = (more) => {
            let item = ui.create('li');
            item.classList.add('name');
            item.appendChild(this.spanWithText(`and ${more} more...`));
            this.users.appendChild(item);
        };
        this.getPresetByName = (name) => {
            return Persistance.loadStorage()[name];
        };
        this.addName = () => {
            this.input.value && this.userSet.add(this.input.value);
            this.input.value = '';
            this.render();
        };
        this.userListSize = () => {
            return this.userSet.size;
        };
        this.remove = (name) => {
            this.userSet.delete(name);
            this.render();
        };
        this.loadUsersFromPreset = (name) => {
            this.userSet = new Set(this.getPresetByName(name));
            this.render();
            this.toggleHidden("preset");
        };
        this.loadAndNotifyPreset = (name) => {
            this.loadUsersFromPreset(name);
            Toast.toastWithDuration("Loaded preset: " + name, 1300);
        };
        this.preview = (presetName) => {
            const name = decodeURIComponent(presetName);
            const presetList = this.getPresetByName(name);
            if (presetList) {
                const preview = ui.get("presetPreview");
                preview.innerHTML = `<h2>Preset: "${name}"</h2>`;
                for (let name of presetList) {
                    preview.appendChild(this.createPrevieUserEntry(name));
                }
            }
        };
        this.createPrevieUserEntry = (name) => {
            const li = ui.create("li");
            li.classList.add("name");
            li.innerHTML = `<span>${name}</span>`;
            return li;
        };
        this.closePopup = () => {
            ui.get('result').innerHTML = '';
            ui.get("users").hidden = false;
        };
        this.resultPopup = (scores) => {
            const popup = ui.create('div');
            const wrapper = ui.create('div');
            popup.id = 'popup';
            wrapper.classList.add('result');
            popup.classList.add('popup');
            const medals = ["🥉", "🥈", "🥇"];
            wrapper.innerHTML += `<h1>Congrats ${scores[0].point.name}</h1>`;
            scores.forEach(score => {
                wrapper.innerHTML += `<div><span>${medals.pop()}</span> <span>${score.point.name} -> ${score.score}</span></div>`;
            });
            popup.appendChild(wrapper);
            wrapper.innerHTML += `<div id="confettis">
                            <div class="confetti"></div>
                            <div class="confetti"></div>
                            <div class="confetti"></div>
                            <div class="confetti"></div>
                            <div class="confetti"></div>
                            <div class="confetti"></div>
                            <div class="confetti"></div>
                            <div class="confetti"></div>
                            <div class="confetti"></div>
                            <div class="confetti"></div>
                        </div>`;
            ui.get('result').appendChild(popup);
        };
        this.toggleHidden = (id) => {
            const element = ui.get(id);
            element.hidden = !element.hidden;
            this.populatePresetList();
        };
        this.populatePresetList = () => {
            let data = Persistance.loadStorage();
            const preset = ui.get("presetList");
            preset.innerHTML = "";
            if (data) {
                for (const [name] of Object.entries(data)) {
                    const item = this.createPresetListItem(name);
                    preset.appendChild(item);
                }
            }
        };
        this.createPresetListItem = (name) => {
            const userName = this.spanWithText(name);
            const loadPresetButton = ui.create('button');
            loadPresetButton.textContent = '-';
            loadPresetButton.addEventListener('click', (event) => this.removePreset(event, name));
            const div = ui.create('div');
            div.classList.add('preset-item');
            div.onclick = () => this.loadAndNotifyPreset(name);
            div.onmouseenter = () => this.preview(encodeURIComponent(name));
            div.appendChild(userName);
            div.appendChild(loadPresetButton);
            const li = ui.create("li");
            li.classList.add("name");
            li.appendChild(div);
            return li;
        };
        this.spanWithText = (text) => {
            const span = ui.create('span');
            span.textContent = text;
            return span;
        };
        this.removePreset = (event, name) => {
            event.stopPropagation();
            if (confirm("Are you sure you want to delete preset " + name)) {
                let storage = Persistance.loadStorage();
                delete storage[name];
                Persistance.saveStorage(storage);
                Toast.toastWithDuration("Removed preset: " + name, 1500);
                this.populatePresetList();
            }
        };
    }
    initCanvas() {
        const canvas = ui.get('canvas');
        canvas.width = innerWidth;
        canvas.height = innerHeight;
        return canvas;
    }
}
class Persistance {
}
Persistance.saveStorage = (data) => {
    try {
        localStorage.setItem("endj_randompicker", JSON.stringify(data));
    }
    catch (e) {
        console.error(e);
    }
};
Persistance.loadStorage = () => {
    try {
        return JSON.parse(localStorage.getItem("endj_randompicker"));
    }
    catch (e) {
        console.error(e);
    }
};
class StateMachine {
    constructor(ui, renderSize, renderer) {
        this.isRunning = () => this.state.running;
        this.runSimulation = () => {
            if (this.ui.userListSize() === 0) {
                return;
            }
            this.onStart();
            this.state.initializePoints(this.ui.userSet);
            this.state.initializeTarget();
            this.state.initializeEffects();
            this.tick();
        };
        this.onStart = () => {
            this.state.running = true;
            this.ui.get('init-btn').disabled = true;
            this.ui.get("users").hidden = true;
            canvas.hidden = false;
            if (!State.isMobile) {
                this.ui.get("canvas").requestFullscreen();
            }
        };
        this.onEnd = (result, target) => {
            this.ui.get('init-btn').disabled = false;
            document.fullscreen && document.exitFullscreen();
            const scores = this.computeFinalScore(result, target);
            const top3 = scores.slice(0, 3);
            this.renderer.drawWinnerLines(top3, target);
            this.ui.resultPopup(top3);
            SOUND.applause.play();
            setTimeout(this.ui.closePopup, 6000);
        };
        this.computeFinalScore = (points, target) => {
            const result = [];
            points.forEach(p => {
                const [x, y] = [p.x + Point.pointRenderSize / 2, p.y + Point.pointRenderSize / 2];
                const distance = Math.sqrt(Math.pow((x - target.x), 2) + Math.pow((y - target.y), 2));
                result.push(new Score(distance, p));
            });
            return result.sort((a, b) => a.score - b.score);
        };
        this.tick = () => {
            this.renderer.clear();
            let done = true;
            let target = this.state.target;
            let positions = this.state.positions;
            var i = 0, len = positions.length;
            while (i < len) {
                const point = positions[i];
                this.state.updatePoint(point);
                this.renderer.drawPoint(point);
                done = done && point.velocity === 0;
                i++;
            }
            this.state.pickups = this.state.pickups.filter(pickup => {
                let point = this.detectPickupColision(pickup, positions);
                if (point) {
                    this.state.effects.push(pickup.appliedEffect(this, point));
                    return false;
                }
                else {
                    this.renderer.drawImage(pickup.img, pickup.x, pickup.y);
                    return true;
                }
            });
            this.state.effects.forEach(effect => effect.next());
            this.renderer.drawTarget(target);
            if (!done) {
                window.requestAnimationFrame(this.tick);
            }
            else {
                this.state.running = false;
                this.onEnd(positions, target);
            }
        };
        this.detectPickupColision = (effect, points) => {
            const img = effect.img;
            for (let point of points) {
                if (point.x >= effect.x && point.x < (effect.x + img.width)) {
                    if (point.y >= effect.y && point.y < (effect.y + img.height)) {
                        return point;
                    }
                }
            }
            return undefined;
        };
        this.ui = ui;
        this.state = new State(renderSize, this.onEnd);
        this.renderer = renderer;
    }
}
const ui = new UI();
const canvas = ui.initCanvas();
const renderconfig = new RenderConfig(20, true, 25);
const renderConstraint = new RenderSize(canvas.width, canvas.height);
const renderer = new CanvasRenderer(canvas, renderconfig);
const statemachine = new StateMachine(ui, renderConstraint, renderer);
document.addEventListener('keypress', e => {
    if (e.key == 'Enter') {
        if (e.shiftKey && !statemachine.isRunning()) {
            statemachine.runSimulation();
        }
        else {
            ui.addName();
        }
    }
});
ui.get('add-name').addEventListener('click', ui.addName);
ui.get('save-preset').addEventListener('click', ui.saveToPreset);
ui.get('toggle-preset').onclick = () => ui.toggleHidden('preset');
ui.get('init-btn').onclick = () => statemachine.runSimulation();
