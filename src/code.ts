
let CONFIG = {
    userListRenderLimit: 25,
    baseVelocity: 10,
    randomVelocity: 2,
}
const SOUND = {
    applause: new Audio("a.wav")
}

class RGB {
    r: number;
    g: number;
    b: number;
    constructor(r: number, g: number, b: number) {
        this.r = r;
        this.g = g;
        this.b = b;
    }
    asString = (): string => {
        return `rgb(${this.r},${this.g},${this.b})`;
    }
}

class PixelImage {
    name: ImageNames;
    imgData: HTMLImageElement;
    height: number;
    width: number;
    constructor(name: ImageNames, sourcePath: string, height: number, width: number) {
        this.name = name;
        this.height = height;
        this.width = width;
        let image = new Image();
        image.src = sourcePath;
        this.imgData = image;
    }
}

enum ImageNames {
    TELEPORT,
    DUPLICATE,
    GRAVITY
}

class Images {
    static images: Map<ImageNames, PixelImage> = new Map([
        [ImageNames.DUPLICATE, new PixelImage(ImageNames.DUPLICATE, "duplicate.png", 48, 48)],
        [ImageNames.TELEPORT, new PixelImage(ImageNames.TELEPORT, "teleport.png", 48, 48)],
        [ImageNames.GRAVITY, new PixelImage(ImageNames.GRAVITY, "blackhole.png", 48, 48)]
    ]);
    static getImage = (name: ImageNames) => Images.images.get(name);
}

class Maths {
    private static hashCache: Map<string, number> = new Map();
    static coinflip = () => Math.random() > 0.5;
    static distance = (x1, y1, x2, y2) => Math.sqrt(Math.pow((x1 - x2), 2) + Math.pow((y1 - y2), 2))
    static normalize = (val, min, max, range) => (val - min) / ((max - min) * range)
    static hashString = (text: string): number => {
        const cachedHash = Maths.hashCache.get(text);
        if (cachedHash) {
            return cachedHash;
        }
        let hash = 0x811c9dc5
        for (let i = 0, l = text.length; i < l; i++) {
            hash ^= text.charCodeAt(i);
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }
        Maths.hashCache.set(text, hash >>> 0);
        return hash >>> 0;
    }
    static numberToColour = (num: number): RGB => {
        num >>>= 0;
        return new RGB(num & 0xFF, (num & 0xFF00) >>> 8, (num & 0xFF0000) >>> 16);
    }
}

class Target {
    x: number;
    y: number;
    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }
}

class Point {
    name: string;
    colour: RGB;
    x: number;
    y: number;
    dx: number;
    dy: number;
    velocity: number
    static pointRenderSize: number = 2;

    constructor(name: string, x: number, y: number, dx: number, dy: number, velocity: number) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.velocity = velocity;
        this.colour = Maths.numberToColour(Maths.hashString(name));
    }
}

enum EffectNames {
    TELEPORT,
    DUPLICATE,
    GRAVITY
}

class EffectFunctions {
    static coinflip = () => Math.random() > 0.5;

    static effects: Map<EffectNames, (context: StateMachine, p: Point) => Generator<boolean>> = new Map([
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
            const [x, y] = [p.x, p.y]
            const canvasContext = context.renderer.context;

            const applyForce = (p: Point, size: number) => {
                let dx = Math.abs(p.x - x);
                let dy = Math.abs(p.y - y);

                let normX = Maths.normalize(dx, 0, context.renderer.W, 300) * size;
                let normY = Maths.normalize(dy, 0, context.renderer.H, 300) * size;

                p.dx = p.x > x ? p.dx - normX : p.dx + normX
                p.dy = p.y > y ? p.dy - normY : p.dy + normY
            }
            const drawCircle = (size: number) => {
                canvasContext.beginPath()
                canvasContext.arc(x, y, size, 0, 2 * Math.PI)
                canvasContext.fill();
            }

            for (let i = 0; i < tickPerSec * 4; i++) {
                const blackHoleSize = Math.min(i * 0.4, maxSize);
                drawCircle(blackHoleSize)
                context.state.positions.forEach(p => {
                    applyForce(p, blackHoleSize);
                })
                yield true
            }
            for (let i = tickPerSec * 2; i > 0; i--) {
                const blackHoleSize = Math.min(i, maxSize);
                drawCircle(blackHoleSize)
                context.state.positions.forEach(p => {
                    applyForce(p, blackHoleSize);
                })
                yield true
            }

            yield false
        }
        ]
    ])

    static getFunction = (effectName: EffectNames) => EffectFunctions.effects.get(effectName);
}

class Pickups {
    img: PixelImage;
    x: number;
    y: number;
    id: number;
    appliedEffect: (context: StateMachine, p: Point) => Generator<boolean>;
    constructor(img: PixelImage, x: number, y: number, appliedEffect: (context: StateMachine, p: Point) => Generator<boolean>) {
        this.img = img;
        this.x = x;
        this.y = y;
        this.id = Math.random();
        this.appliedEffect = appliedEffect;
    }
}

class EffectsRepository {
    static effects: Map<EffectNames, Pickups> = new Map([
        [EffectNames.DUPLICATE,
        new Pickups(Images.getImage(ImageNames.DUPLICATE), 0, 0, EffectFunctions.getFunction(EffectNames.DUPLICATE))],
        [EffectNames.TELEPORT,
        new Pickups(Images.getImage(ImageNames.TELEPORT), 0, 0, EffectFunctions.getFunction(EffectNames.TELEPORT))],
        [EffectNames.GRAVITY,
        new Pickups(Images.getImage(ImageNames.GRAVITY), 0, 0, EffectFunctions.getFunction(EffectNames.GRAVITY))]
    ])
    static getEffect = (name: EffectNames) => EffectsRepository.effects.get(name);
    static createEffect = (name: EffectNames) => {
        const effect = EffectsRepository.getEffect(name);
        return new Pickups(effect.img, effect.x, effect.y, effect.appliedEffect);
    }
}


class Score {
    score: number;
    point: Point;
    constructor(score: number, point: Point) {
        this.score = score;
        this.point = point;
    }
}

class RenderSize {
    width: number;
    height: number;
    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
    }
}

class State {
    running: boolean = false;
    static isMobile: boolean = !!/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    positions: Point[] = [];
    pickups: Pickups[] = [];
    effects: Generator<boolean>[] = [];
    target: Target = new Target(0, 0);
    readonly renderConstraints: RenderSize;
    onCompletion: (final: Point[], target: Target) => void;

    constructor(renderConstraints: RenderSize, onCompletion: (final: Point[], target: Target) => void) {
        this.renderConstraints = renderConstraints;
        this.onCompletion = onCompletion;
    }

    private coinflip = () => Math.random() > 0.5;


    initializePoints(users: Set<string>) {
        let W = this.renderConstraints.width
        let H = this.renderConstraints.height
        this.positions = [...users].map((name: string) => {
            const dx = Math.random();
            const dy = Math.random();
            return new Point(
                name,
                Math.floor(W / 2 + (this.coinflip() ? -Math.random() * W / 8 : Math.random() * W / 8)),
                Math.floor(H / 2 + (this.coinflip() ? -Math.random() * H / 8 : Math.random() * H / 8)),
                this.coinflip() ? dx : -dx,
                this.coinflip() ? dy : -dy,
                CONFIG.baseVelocity + Math.random() * CONFIG.randomVelocity
            );
        });
    }

    initializeEffects = () => {
        const numOfEffects = Math.min(5, this.positions.length);
        this.pickups.push(this.effectWithRandomLocation(EffectNames.DUPLICATE));
        this.pickups.push(this.effectWithRandomLocation(EffectNames.TELEPORT));
        this.pickups.push(this.effectWithRandomLocation(EffectNames.GRAVITY));
        for (let i = 0; i < numOfEffects; i++) {
            this.pickups.push(this.randomEffectAndLocation())
        }
    }


    randomEffectAndLocation = (): Pickups => {
        let choices = [EffectNames.DUPLICATE, EffectNames.TELEPORT]
        return this.effectWithRandomLocation(choices[Math.floor((Math.random()) * choices.length)])
    }

    effectWithRandomLocation = (effect: EffectNames) => {
        const e: Pickups = EffectsRepository.createEffect(effect);
        let [x, y] = this.safeRandomLocation()
        e.x = x;
        e.y = y;
        return e;
    }

    initializeTarget = () => {
        let [x, y] = this.safeRandomLocation();
        this.target = new Target(x, y)
    }

    safeRandomLocation = () => {
        let W = this.renderConstraints.width
        let H = this.renderConstraints.height
        return [Math.floor(100 + Math.random() * (W - 200)), Math.floor(100 + Math.random() * (H - 200))]
    }

    updatePoint = (p: Point) => {
        let W = this.renderConstraints.width
        let H = this.renderConstraints.height
        if (p.x > W) {
            p.dx = p.dx > 0 ? -p.dx : p.dx
        }
        if (p.x < 0) {
            p.dx = p.dx > 0 ? p.dx : -p.dx
        }
        if (p.y > H) {
            p.dy = p.dy > 0 ? -p.dy : p.dy
        }
        if (p.y < 0) {
            p.dy = p.dy > 0 ? p.dy : -p.dy
        }
        p.x = p.x + (p.dx * p.velocity) % W;
        p.y = p.y + (p.dy * p.velocity) % H;
        if (p.velocity !== 0) {
            p.velocity = Math.abs(p.velocity - 0.01) > 0.1 ? p.velocity - 0.01 : 0;
        }
    }

}

interface Renderer {
    clear: () => void;
    drawPoint: (p: Point) => void;
    drawTarget: (t: Target) => void;
    drawWinnerLines: (s: Score[], t: Target) => void;
    drawEffect: (e: Pickups) => void;
    drawImage: (i: PixelImage, x: number, y: number) => void;
}

class RenderConfig {
    maxRenderElements: number;
    renderNames: boolean;
    userListRenderLimit: number;
    constructor(maxRenderElements: number, renderNames: boolean, userListRenderLimit) {
        this.maxRenderElements = maxRenderElements;
        this.renderNames = renderNames;
        this.userListRenderLimit = userListRenderLimit;
    }
}

class CanvasRenderer implements Renderer {
    readonly W: number;
    readonly H: number;
    readonly context: CanvasRenderingContext2D;
    readonly canvas: HTMLCanvasElement;
    readonly config: RenderConfig;

    constructor(canvas: HTMLCanvasElement, config: RenderConfig) {
        this.canvas = canvas;
        this.W = canvas.width;
        this.H = canvas.height;
        this.context = canvas.getContext('2d', { alpha: false });
        this.context.font = '30px Arial';
        this.config = config;
    }

    clear = (): void => {
        this.context.fillStyle = 'white';
        this.context.fillRect(0, 0, this.W, this.H);
        this.context.strokeStyle = 'black'
        this.context.fillStyle = "black"
    }

    drawPoint = (point: Point) => {
        this.context.fillRect(point.x, point.y, Point.pointRenderSize, Point.pointRenderSize);
        if (this.config.renderNames) {
            this.context.fillStyle = point.colour.asString();
            this.context.strokeStyle = 'black';
            this.context.fillText(point.name, point.x + 10, point.y + 10);
            this.context.strokeText(point.name, point.x + 10, point.y + 10);
            this.context.fillStyle = 'black';
        }
    };

    drawWinnerLines = (scores: Score[], target: Target) => {
        const c = this.context;
        const colors: string[] = ["red", "yellow", "green"]
        scores.forEach(score => {
            const [x, y] = [score.point.x + Point.pointRenderSize / 2, score.point.y + Point.pointRenderSize / 2];
            c.strokeStyle = colors.pop();
            c.beginPath()
            c.moveTo(x, y)
            c.lineTo(target.x, target.y)
            c.stroke()
        })
        c.strokeStyle = "black";
    }

    drawEffect = (effect: Pickups) => {
        this.context.drawImage(effect.img.imgData, effect.x, effect.y);
    }

    drawTarget = (target: Target) => {
        const c = this.context;
        const orig = c.lineWidth
        c.lineWidth = 10;
        c.strokeStyle = "red"
        c.beginPath();
        c.moveTo(target.x - 10, target.y - 10);
        c.lineTo(target.x + 10, target.y + 10);
        c.stroke();
        c.beginPath();
        c.moveTo(target.x - 10, target.y + 10);
        c.lineTo(target.x + 10, target.y - 10);
        c.stroke();
        c.lineWidth = orig
    };

    drawImage = (image: PixelImage, x: number, y: number) => {
        this.context.drawImage(image.imgData, x, y, image.width, image.height)
    }
}

class Toast {
    static toast = (message: string) => Toast.toastWithDuration(message, 3000)
    static toastWithDuration = (message: string, duration: number) => {
        try {
            const container = ui.create("div");
            container.classList.add("toast");

            const text = ui.create("div");
            text.innerHTML = message;
            container.appendChild(text);
            document.body.appendChild(container)

            setTimeout(() => { container.classList.add("fadein") }, 500);
            setTimeout(() => {
                container.classList.remove("fadein");
                container.classList.add("toast", "fadeout");
            }, 500 + duration);
            setTimeout(() => { document.body.removeChild(container) }, 500 + duration + 1000);
        } catch (e) {
            console.error(e)
        }
    }
}

class UI {
    get = (id: string): HTMLElement => document.getElementById(id);
    create = (type: string): HTMLElement => document.createElement(type);
    userSet: Set<string> = new Set();
    input = this.get('in') as HTMLInputElement;
    users = this.get('users');

    savePresetToStorage = (name: string) => {
        if (this.userSet.size > 0) {
            const storage = Persistance.loadStorage() || {}
            storage[name] = [...this.userSet]
            Persistance.saveStorage(storage)
        }
    }

    saveToPreset = () => {
        const name = prompt("Name of preset")
        if (name && this.userSet.size > 0) {
            this.savePresetToStorage(name);
            Toast.toast("Created preset " + name)
            this.populatePresetList()
        } else {
            Toast.toast("Creating preset requires at least 1 name")
        }
    }

    render = () => {
        ui.get('users').innerHTML = '';
        let renderedUsers: number = Math.min(CONFIG.userListRenderLimit, this.userSet.size);
        for (let user of this.userSet) {
            this.addUserToList(user);
            if (renderedUsers-- === 0) {
                this.addUserListContinuation(this.userSet.size - CONFIG.userListRenderLimit)
                break
            }
        }
    };

    addUserToList = (name: string) => {
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

    addUserListContinuation = (more: number) => {
        let item = ui.create('li')
        item.classList.add('name');
        item.appendChild(this.spanWithText(`and ${more} more...`))
        this.users.appendChild(item)
    }

    getPresetByName = (name: string) => {
        return Persistance.loadStorage()[name]
    }

    addName = () => {
        this.input.value && this.userSet.add(this.input.value);
        this.input.value = '';
        this.render();
    };

    userListSize = () => {
        return this.userSet.size;
    }

    remove = (name: string) => {
        this.userSet.delete(name);
        this.render();
    };

    loadUsersFromPreset = (name: string) => {
        this.userSet = new Set(this.getPresetByName(name));
        this.render()
        this.toggleHidden("preset")
    }

    loadAndNotifyPreset = (name: string) => {
        this.loadUsersFromPreset(name)
        Toast.toastWithDuration("Loaded preset: " + name, 1300)
    }

    preview = (presetName: string) => {
        const name = decodeURIComponent(presetName)
        const presetList = this.getPresetByName(name);
        if (presetList) {
            const preview = ui.get("presetPreview")
            preview.innerHTML = `<h2>Preset: "${name}"</h2>`
            for (let name of presetList) {
                preview.appendChild(this.createPrevieUserEntry(name))
            }
        }
    }

    createPrevieUserEntry = (name: string) => {
        const li = ui.create("li")
        li.classList.add("name")
        li.innerHTML = `<span>${name}</span>`
        return li
    }

    closePopup = () => {
        ui.get('result').innerHTML = '';
        ui.get("users").hidden = false;
    };

    resultPopup = (scores: Score[]) => {
        const popup = ui.create('div');
        const wrapper = ui.create('div');
        popup.id = 'popup';
        wrapper.classList.add('result');
        popup.classList.add('popup');


        const medals = ["🥉", "🥈", "🥇"]
        wrapper.innerHTML += `<h1>Congrats ${scores[0].point.name}</h1>`
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
                        </div>`

        ui.get('result').appendChild(popup);
    };

    toggleHidden = (id: string) => {
        const element = ui.get(id)
        element.hidden = !element.hidden
        this.populatePresetList()
    }

    populatePresetList = () => {
        let data = Persistance.loadStorage()
        const preset = ui.get("presetList")
        preset.innerHTML = ""
        if (data) {
            for (const [name] of Object.entries(data)) {
                const item = this.createPresetListItem(name);
                preset.appendChild(item);
            }
        }
    }

    createPresetListItem = (name: string): HTMLElement => {
        const userName = this.spanWithText(name);

        const loadPresetButton = ui.create('button');
        loadPresetButton.textContent = '-';
        loadPresetButton.addEventListener('click', (event) => this.removePreset(event, name));

        const div = ui.create('div')
        div.classList.add('preset-item');
        div.onclick = () => this.loadAndNotifyPreset(name);
        div.onmouseenter = () => this.preview(encodeURIComponent(name));
        div.appendChild(userName)
        div.appendChild(loadPresetButton)

        const li = ui.create("li");
        li.classList.add("name");
        li.appendChild(div);
        return li;
    }

    spanWithText = (text: string) => {
        const span = ui.create('span')
        span.textContent = text;
        return span;
    }

    removePreset = (event: Event, name: string) => {
        event.stopPropagation()
        if (confirm("Are you sure you want to delete preset " + name)) {
            let storage = Persistance.loadStorage()
            delete storage[name]
            Persistance.saveStorage(storage)
            Toast.toastWithDuration("Removed preset: " + name, 1500)
            this.populatePresetList()
        }
    }

    initCanvas(): HTMLCanvasElement {
        const canvas = ui.get('canvas') as HTMLCanvasElement;
        canvas.width = innerWidth;
        canvas.height = innerHeight;
        return canvas;
    }

}

class Persistance {
    static saveStorage = (data: any) => {
        try {
            localStorage.setItem("endj_randompicker", JSON.stringify(data))
        } catch (e) {
            console.error(e)
        }
    }

    static loadStorage = (): any => {
        try {
            return JSON.parse(localStorage.getItem("endj_randompicker"))
        } catch (e) {
            console.error(e);
        }
    }
}


class StateMachine {
    ui: UI;
    state: State;
    renderer: CanvasRenderer;
    constructor(ui: UI, renderSize: RenderSize, renderer: CanvasRenderer) {
        this.ui = ui;
        this.state = new State(renderSize, this.onEnd);
        this.renderer = renderer;
    }

    isRunning = () => this.state.running;

    runSimulation = () => {
        if (this.ui.userListSize() === 0) {
            return
        }
        this.onStart();
        this.state.initializePoints(this.ui.userSet)
        this.state.initializeTarget();
        this.state.initializeEffects();
        this.tick();
    }

    onStart = () => {
        this.state.running = true;
        (this.ui.get('init-btn') as HTMLInputElement).disabled = true;
        this.ui.get("users").hidden = true;
        canvas.hidden = false;
        if (!State.isMobile) {
            this.ui.get("canvas").requestFullscreen()
        }
    };

    onEnd = (result: Point[], target: Target) => {
        (this.ui.get('init-btn') as HTMLInputElement).disabled = false;
        document.fullscreen && document.exitFullscreen()
        const scores: Score[] = this.computeFinalScore(result, target);
        const top3 = scores.slice(0, 3)
        this.renderer.drawWinnerLines(top3, target)
        this.ui.resultPopup(top3)
        SOUND.applause.play()
        setTimeout(this.ui.closePopup, 6000);
    };

    computeFinalScore = (points: Point[], target: Target): Score[] => {
        const result: Score[] = [];
        points.forEach(p => {
            const [x, y] = [p.x + Point.pointRenderSize / 2, p.y + Point.pointRenderSize / 2];
            const distance = Math.sqrt(Math.pow((x - target.x), 2) + Math.pow((y - target.y), 2));
            result.push(new Score(distance, p));
        });
        return result.sort((a, b) => a.score - b.score);
    };

    tick = () => {
        this.renderer.clear();
        let done: boolean = true;

        let target = this.state.target;
        let positions = this.state.positions;
        var i: number = 0, len: number = positions.length;
        while (i < len) {
            const point = positions[i];
            this.state.updatePoint(point)
            this.renderer.drawPoint(point)
            done = done && point.velocity === 0;
            i++;
        }


        this.state.pickups = this.state.pickups.filter(pickup => {
            let point = this.detectPickupColision(pickup, positions);
            if (point) {
                this.state.effects.push(pickup.appliedEffect(this, point))
                return false;
            } else {
                this.renderer.drawImage(pickup.img, pickup.x, pickup.y)
                return true;
            }
        })
        this.state.effects.forEach(effect => effect.next())
        this.renderer.drawTarget(target);
        if (!done) {
            window.requestAnimationFrame(this.tick);
        } else {
            this.state.running = false;
            this.onEnd(positions, target);
        }
    };

    detectPickupColision = (effect: Pickups, points: Point[]): Point | undefined => {
        const img: PixelImage = effect.img;
        for (let point of points) {
            if (point.x >= effect.x && point.x < (effect.x + img.width)) {
                if (point.y >= effect.y && point.y < (effect.y + img.height)) {
                    return point;
                }
            }
        }
        return undefined;
    }
}

const ui = new UI();
const canvas = ui.initCanvas();
const renderconfig = new RenderConfig(20, true, 25);
const renderConstraint = new RenderSize(canvas.width, canvas.height);
const renderer = new CanvasRenderer(canvas, renderconfig)
const statemachine = new StateMachine(ui, renderConstraint, renderer);

document.addEventListener('keypress', e => {
    if (e.key == 'Enter') {
        if (e.shiftKey && !statemachine.isRunning()) {
            statemachine.runSimulation();
        } else {
            ui.addName();
        }
    }
});


ui.get('add-name').addEventListener('click', ui.addName);
ui.get('save-preset').addEventListener('click', ui.saveToPreset);
ui.get('toggle-preset').onclick = () => ui.toggleHidden('preset');
ui.get('init-btn').onclick = () => statemachine.runSimulation();







