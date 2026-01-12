(function () {
    /**
     * BanterCheckers Unified Embed Script
     * Loads dependencies, initializes game logic, and renders the board in Banter.
     */

    // --- Configuration ---
    const config = {
        boardPosition: new BS.Vector3(0, 1.1, -2),
        boardRotation: new BS.Vector3(0, 0, 0),
        boardScale: new BS.Vector3(1, 1, 1),
        resetPosition: new BS.Vector3(0, 0, 2.5),
        resetRotation: new BS.Vector3(0, 0, 0),
        resetScale: new BS.Vector3(1, 1, 1),
        instance: window.location.href.split('?')[0],
        hideUI: false,
        hideBoard: false,
        useCustomModels: false,
        lighting: 'unlit',
        addLights: true
    };

    // Helper to parse Vector3 from string
    const parseVector3 = (str, defaultVal) => {
        if (!str) return defaultVal;
        const s = str.trim();
        if (s.includes(' ')) {
            const parts = s.split(' ').map(Number);
            if (parts.length === 3) return new BS.Vector3(parts[0], parts[1], parts[2]);
        } else {
            const val = parseFloat(s);
            if (!isNaN(val)) return new BS.Vector3(val, val, val);
        }
        return defaultVal;
    };

    // Parse URL params from this script tag
    const currentScript = document.currentScript;
    if (currentScript) {
        const url = new URL(currentScript.src);
        const params = new URLSearchParams(url.search);

        if (params.has('hideUI')) config.hideUI = params.get('hideUI') === 'true';
        if (params.has('hideBoard')) config.hideBoard = params.get('hideBoard') === 'true';
        if (params.has('instance')) config.instance = params.get('instance');
        if (params.has('useCustomModels')) config.useCustomModels = params.get('useCustomModels') === 'true';
        if (params.has('lighting')) config.lighting = params.get('lighting');
        if (params.has('addLights')) config.addLights = params.get('addLights') !== 'false';

        config.boardScale = parseVector3(params.get('boardScale'), config.boardScale);
        config.boardPosition = parseVector3(params.get('boardPosition'), config.boardPosition);
        config.boardRotation = parseVector3(params.get('boardRotation'), config.boardRotation);

        config.resetPosition = parseVector3(params.get('resetPosition'), config.resetPosition);
        config.resetRotation = parseVector3(params.get('resetRotation'), config.resetRotation);
        config.resetScale = parseVector3(params.get('resetScale'), config.resetScale);
    }

    const PIECE_MODELS = {
        'r': 'DiscRed.glb',
        'b': 'DiscDarkGrey.glb'
    };

    function getModelUrl(modelName) {
        try {
            if (currentScript) {
                return new URL(`Models/${modelName}`, currentScript.src).href;
            }
        } catch (e) { console.error("Error resolving model URL:", e); }
        return `Models/${modelName}`;
    }

    // --- Dependency Loading ---
    const loadScript = (src) => {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) return resolve();
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    };

    const loadDependencies = async () => {
        // No external dependencies needed for Space State sync
    };

    // --- Checkers Game Logic ---
    class CheckersGame {
        constructor() {
            this.board = this.createInitialBoard();
            this.currentPlayer = 'red'; // red moves first
            this.selectedPiece = null;
            this.mustJump = false;
            this.winner = null; // Add this line
            this.onMoveCallback = null;
        }

        createInitialBoard() {
            // 8x8 board, null for empty, 'r'/'R' for red (regular/king), 'b'/'B' for black (regular/king)
            // Only dark squares are used (odd column + even row, or even column + odd row)
            const board = Array(8).fill(null).map(() => Array(8).fill(null));

            // Place black pieces (top 3 rows, on dark squares)
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 8; col++) {
                    if ((row + col) % 2 === 1) {
                        board[row][col] = 'b';
                    }
                }
            }

            // Place red pieces (bottom 3 rows, on dark squares)
            for (let row = 5; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                    if ((row + col) % 2 === 1) {
                        board[row][col] = 'r';
                    }
                }
            }

            return board;
        }

        reset() {
            this.board = this.createInitialBoard();
            this.currentPlayer = 'red';
            this.selectedPiece = null;
            this.mustJump = false;
            this.winner = null;
        }

        getPiece(row, col) {
            if (row < 0 || row >= 8 || col < 0 || col >= 8) return null;
            return this.board[row][col];
        }

        setPiece(row, col, piece) {
            this.board[row][col] = piece;
        }

        isOwnPiece(piece) {
            if (!piece) return false;
            const lower = piece.toLowerCase();
            return (this.currentPlayer === 'red' && lower === 'r') ||
                (this.currentPlayer === 'black' && lower === 'b');
        }

        isOpponentPiece(piece) {
            if (!piece) return false;
            const lower = piece.toLowerCase();
            return (this.currentPlayer === 'red' && lower === 'b') ||
                (this.currentPlayer === 'black' && lower === 'r');
        }

        isKing(piece) {
            return piece === piece.toUpperCase();
        }

        getValidMoves(row, col) {
            const piece = this.getPiece(row, col);
            if (!piece || !this.isOwnPiece(piece)) return [];

            const moves = [];
            const isKing = this.isKing(piece);
            const isRed = piece.toLowerCase() === 'r';

            // Direction: red moves up (negative row), black moves down (positive row)
            const directions = isKing ? [-1, 1] : (isRed ? [-1] : [1]);

            // Check regular moves and jumps
            for (const rowDir of directions) {
                for (const colDir of [-1, 1]) {
                    // Simple move
                    const newRow = row + rowDir;
                    const newCol = col + colDir;

                    // Boundary check
                    if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
                        if (this.board[newRow][newCol] === null) {
                            moves.push({ from: [row, col], to: [newRow, newCol], type: 'move', captures: [] });
                        }
                    }

                    // Jump move
                    const midRow = row + rowDir;
                    const midCol = col + colDir;
                    const jumpRow = row + rowDir * 2;
                    const jumpCol = col + colDir * 2;

                    // Boundary checks for mid and jump squares
                    if (jumpRow >= 0 && jumpRow < 8 && jumpCol >= 0 && jumpCol < 8) {
                        const midPiece = this.getPiece(midRow, midCol);
                        const jumpPiece = this.getPiece(jumpRow, jumpCol);

                        if (this.isOpponentPiece(midPiece) && jumpPiece === null) {
                            moves.push({
                                from: [row, col],
                                to: [jumpRow, jumpCol],
                                type: 'jump',
                                captures: [[midRow, midCol]]
                            });
                        }
                    }
                }
            }

            return moves;
        }

        getAllValidMoves() {
            // If in the middle of a multi-jump, only jumps for that piece are valid
            if (this.mustJump && this.selectedPiece) {
                const [row, col] = this.selectedPiece;
                return this.getValidMoves(row, col).filter(m => m.type === 'jump');
            }

            const allMoves = [];
            const allJumps = [];

            for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                    const piece = this.getPiece(row, col);
                    if (piece && this.isOwnPiece(piece)) {
                        const moves = this.getValidMoves(row, col);
                        moves.forEach(move => {
                            if (move.type === 'jump') {
                                allJumps.push(move);
                            } else {
                                allMoves.push(move);
                            }
                        });
                    }
                }
            }

            // If any jumps available, must jump (forced capture rule)
            return allJumps.length > 0 ? allJumps : allMoves;
        }

        canContinueJumping(row, col) {
            const piece = this.getPiece(row, col);
            if (!piece) return false;

            const moves = this.getValidMoves(row, col);
            return moves.some(move => move.type === 'jump');
        }

        countPieces() {
            let red = 0;
            let black = 0;
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const piece = this.getPiece(r, c);
                    if (piece) {
                        if (piece.toLowerCase() === 'r') red++;
                        else if (piece.toLowerCase() === 'b') black++;
                    }
                }
            }
            return { red, black };
        }

        checkWinCondition() {
            if (this.winner) return; // Game already won

            const { red, black } = this.countPieces();

            if (red === 0) {
                this.winner = 'black';
                console.log("Game over! Black wins - no red pieces left.");
                return;
            }
            if (black === 0) {
                this.winner = 'red';
                console.log("Game over! Red wins - no black pieces left.");
                return;
            }

            const validMoves = this.getAllValidMoves();
            if (validMoves.length === 0) {
                this.winner = this.currentPlayer === 'red' ? 'black' : 'red';
                console.log(`Game over! ${this.winner.charAt(0).toUpperCase() + this.winner.slice(1)} wins - ${this.currentPlayer} has no valid moves.`);
            }
        }

        makeMove(move) {
            if (this.winner) return false; // Don't allow moves if game is over

            const { from, to } = move;
            const [fromRow, fromCol] = from;
            const [toRow, toCol] = to;

            const piece = this.getPiece(fromRow, fromCol);
            if (!piece || !this.isOwnPiece(piece)) return false;

            // Validate move is in valid moves and get the full move object
            const validMoves = this.getAllValidMoves();
            const fullMove = validMoves.find(m =>
                m.from[0] === fromRow && m.from[1] === fromCol &&
                m.to[0] === toRow && m.to[1] === toCol
            );

            if (!fullMove) return false;

            // Execute move
            this.setPiece(toRow, toCol, piece);
            this.setPiece(fromRow, fromCol, null);

            // Handle captures
            if (fullMove.type === 'jump' && fullMove.captures) {
                fullMove.captures.forEach(([capRow, capCol]) => {
                    this.setPiece(capRow, capCol, null);
                });
            }

            // Check for king promotion
            if (piece.toLowerCase() === 'r' && toRow === 0) {
                this.setPiece(toRow, toCol, 'R'); // Red king
            } else if (piece.toLowerCase() === 'b' && toRow === 7) {
                this.setPiece(toRow, toCol, 'B'); // Black king
            }

            // Check for multi-jump
            if (fullMove.type === 'jump' && this.canContinueJumping(toRow, toCol)) {
                this.mustJump = true;
                this.selectedPiece = [toRow, toCol];
                // Don't switch player, allow continuation
            } else {
                // Switch player
                this.currentPlayer = this.currentPlayer === 'red' ? 'black' : 'red';
                this.mustJump = false;
                this.selectedPiece = null;
                this.checkWinCondition(); // Check for win after switching player
            }

            if (this.onMoveCallback) {
                this.onMoveCallback(fullMove);
            }

            return true;
        }

        receiveMove(move) {
            this.makeMove(move);
        }

        getBoardState() {
            return {
                board: this.board.map(row => [...row]),
                currentPlayer: this.currentPlayer,
                mustJump: this.mustJump,
                selectedPiece: this.selectedPiece,
                winner: this.winner
            };
        }

        loadBoardState(state) {
            this.board = state.board.map(row => [...row]);
            this.currentPlayer = state.currentPlayer;
            this.mustJump = state.mustJump || false;
            this.selectedPiece = state.selectedPiece || null;
            this.winner = state.winner || null;
        }
    }

    // --- Banter Board Logic ---
    const COLORS = {
        lightSquare: '#F0D9B5',  // Light tan (non-playable)
        darkSquare: '#B58863',   // Dark brown (playable)
        selected: '#76F250',     // Green
        valid: '#50ABF2',        // Blue
        redPiece: '#DC143C',     // Crimson red
        blackPiece: '#1A1A1A',   // Almost black
        kingCrown: '#FFD700'     // Gold
    };

    function hexToVector4(hex) {
        let c = hex.substring(1);
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        const num = parseInt(c, 16);
        return new BS.Vector4(((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255, 1);
    }

    const state = {
        tiles: {},
        pieces: {},
        selectedSquare: null,
        boardRoot: null,
        piecesRoot: null,
        listenersSetup: false,
        isSyncing: false,
        tileSize: 0.5,
        boardSize: 8,
        offset: 0
    };
    state.offset = (state.boardSize * state.tileSize) / 2 - (state.tileSize / 2);

    async function initializeBoard() {
        // Ensure we have a valid user before proceeding with state logic if possible,
        // though we mainly need it for getSpaceStateValue later.

        state.boardRoot = await new BS.GameObject("CheckersBoardRoot");

        let rootTrans = state.boardRoot.GetComponent(BS.ComponentType.Transform);
        if (!rootTrans) rootTrans = await state.boardRoot.AddComponent(new BS.Transform());

        rootTrans.position = config.boardPosition;
        rootTrans.localEulerAngles = config.boardRotation;
        rootTrans.localScale = config.boardScale;

        // Add lights if lit
        if (config.lighting === 'lit' && config.addLights) {
            const lightGO = await new BS.GameObject("Checkers_DirectionalLight");
            await lightGO.SetParent(state.boardRoot, false);
            let lightTrans = await lightGO.AddComponent(new BS.Transform());
            lightTrans.localPosition = new BS.Vector3(0, 5, -5);
            lightTrans.localEulerAngles = new BS.Vector3(45, 0, 0);
            await lightGO.AddComponent(new BS.Light(1, new BS.Vector4(1, 1, 1, 1), 1, 0.1));
        }

        console.log("Checkers Board Initialized with Config:", config);

        await generateTiles();

        if (!config.hideUI) {
            await createResetButton();
        }

        setupGameListeners();
    }

    async function createResetButton() {
        const btn = await new BS.GameObject("ResetButton").Async();
        await btn.SetParent(state.boardRoot, false);

        let trans = await btn.AddComponent(new BS.Transform());
        trans.localPosition = config.resetPosition;
        trans.localEulerAngles = config.resetRotation;
        trans.localScale = config.resetScale;

        const w = 1.0, h = 0.2, d = 0.4;
        const geoArgs = [BS.GeometryType.BoxGeometry, null, w, h, d, 1, 1, 1, 0.5, 24, 0, 6.28, 0, 6.28, 8, false, 0.5, 0.5, 0, 1, 24, 8, 0.4, 16, 6.28, 2, 3, 5, 5, 0, ""];
        await btn.AddComponent(new BS.BanterGeometry(...geoArgs));

        const redColor = new BS.Vector4(0.8, 0.2, 0.2, 1);
        await btn.AddComponent(new BS.BanterMaterial("Unlit/Diffuse", "", redColor, BS.MaterialSide.Front, false));

        await btn.AddComponent(new BS.BoxCollider(true, new BS.Vector3(0, 0, 0), new BS.Vector3(w, h, d)));
        await btn.SetLayer(5);

        btn.On('click', () => {
            console.log("Resetting game...");
            window.checkersGame.reset();

            const boardState = window.checkersGame.getBoardState();
            const stateKey = `checkers_game_${config.instance}`;
            BS.BanterScene.GetInstance().SetPublicSpaceProps({ [stateKey]: JSON.stringify(boardState) });

            syncBoard();
            clearSelection();
        });
    }

    function rowColToSquare(row, col) {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        return `${files[col]}${8 - row}`;
    }

    function squareToRowCol(square) {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const col = files.indexOf(square[0]);
        const row = 8 - parseInt(square[1]);
        return [row, col];
    }

    async function generateTiles() {
        const size = state.tileSize;

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const squareId = rowColToSquare(row, col);
                const isDark = (row + col) % 2 === 1;

                const xPos = (col * size) - state.offset;
                const zPos = (row * size) - state.offset;

                const tile = await createBanterObject(
                    `Tile_${squareId}`,
                    state.boardRoot,
                    new BS.Vector3(xPos, -0.05, zPos),
                    isDark ? COLORS.darkSquare : COLORS.lightSquare,
                    BS.GeometryType.BoxGeometry,
                    { width: 0.5, height: 0.1, depth: 0.5 },
                    false, // hasCollider
                    1.0, // opacity
                    true // isTile
                );

                tile.On('click', () => handleSquareClick(squareId));
                state.tiles[squareId] = tile;
            }
        }

        await syncBoard();
    }

    async function createBanterObject(name, parent, posLocal, colorHex, geometryType, dims, hasCollider = false, opacity = 1.0, isTile = false) {
        const obj = await new BS.GameObject(name).Async();
        await obj.SetParent(parent, false);

        let transform = obj.GetComponent(BS.ComponentType.Transform);
        if (!transform) transform = await obj.AddComponent(new BS.Transform());
        transform.localPosition = posLocal;

        const geoArgs = getGeometryArgs(geometryType, dims);
        await obj.AddComponent(new BS.BanterGeometry(...geoArgs));

        const color = hexToVector4(colorHex);
        color.w = opacity;

        let shader = "Unlit/Diffuse";
        if (config.lighting === 'lit') {
            shader = "Standard";
        } else if (opacity < 1.0 || (config.hideBoard && isTile)) {
            shader = "Unlit/DiffuseTransparent";
        }

        await obj.AddComponent(new BS.BanterMaterial(shader, "", color, BS.MaterialSide.Front, false));

        let colSize;
        if (geometryType === BS.GeometryType.BoxGeometry) {
            colSize = new BS.Vector3(dims.width, dims.height, dims.depth);
        } else {
            const r = dims.radius || dims.radiusBottom || 0.2;
            const h = dims.height || 0.6;
            colSize = new BS.Vector3(r * 2, h, r * 2);
        }
        await obj.AddComponent(new BS.BoxCollider(true, new BS.Vector3(0, 0, 0), colSize));
        await obj.SetLayer(5);
        return obj;
    }

    function getGeometryArgs(type, d) {
        return [
            type, null, d.width || 1, d.height || 1, d.depth || 1, 1, 1, 1,
            d.radius || 0.5, 24, 0, 6.283185, 0, 6.283185, 8, false,
            d.radiusTop || d.radius || 0.5, d.radiusBottom || d.radius || 0.5,
            0, 1, 24, 8, 0.4, 16, 6.283185, 2, 3, 5, 5, 0, ""
        ];
    }

    function getSquarePos(squareId) {
        const [row, col] = squareToRowCol(squareId);
        const size = state.tileSize;
        const xPos = (col * size) - state.offset;
        const zPos = (row * size) - state.offset;
        return new BS.Vector3(xPos, 0, zPos);
    }

    async function createPiece(pieceChar, squareId, parent) {
        try {
            const isRed = pieceChar.toLowerCase() === 'r';
            const isKing = pieceChar === pieceChar.toUpperCase();
            const type = pieceChar.toLowerCase();

            const piece = await new BS.GameObject(`Piece_${pieceChar}_${Math.random().toString(36).substr(2, 5)}`).Async();
            await piece.SetParent(parent, false);

            let transform = piece.GetComponent(BS.ComponentType.Transform);
            if (!transform) transform = await piece.AddComponent(new BS.Transform());

            const pos = getSquarePos(squareId);
            // Tiles are at Y=-0.05, height 0.1, so surface is at Y=0
            if (config.useCustomModels) {
                pos.y = 0; // Pivot at 0
            } else {
                pos.y = isKing ? 0.075 : 0.05; // Spheres are centered, so half-height offset
            }
            transform.localPosition = pos;

            const radius = 0.18;
            const color = isRed ? hexToVector4(COLORS.redPiece) : hexToVector4(COLORS.blackPiece);
            const shader = config.lighting === 'lit' ? "Standard" : "Unlit/Diffuse";

            if (config.useCustomModels) {
                transform.localScale = new BS.Vector3(1, 1, 1);
                const modelName = PIECE_MODELS[type];
                const url = getModelUrl(modelName);

                // Create a container for the model to handle stacking
                const modelContainer = await new BS.GameObject(`ModelContainer_${type}`).Async();
                await modelContainer.SetParent(piece, false);
                await modelContainer.AddComponent(new BS.Transform());

                const count = isKing ? 2 : 1;
                for (let i = 0; i < count; i++) {
                    const model = await new BS.GameObject(`Model_${i}`).Async();
                    await model.SetParent(modelContainer, false);
                    let modelTrans = await model.AddComponent(new BS.Transform());
                    modelTrans.localPosition = new BS.Vector3(0, i * 0.05, 0); // Stack them
                    modelTrans.localScale = new BS.Vector3(0.18, 0.18, 0.18);
                    modelTrans.localEulerAngles = new BS.Vector3(0, 0, 0);

                    await model.AddComponent(new BS.BanterGLTF(url, false, false, false, false, false, false));
                    await model.AddComponent(new BS.BanterMaterial(shader, "", color, BS.MaterialSide.Front, false));
                }
                
                // Add a simple collider for the GLB stack
                const colHeight = isKing ? 0.1 : 0.05;
                await piece.AddComponent(new BS.BoxCollider(true, new BS.Vector3(0, colHeight / 2, 0), new BS.Vector3(radius * 2, colHeight, radius * 2)));

            } else {
                // Create rounded piece (flattened sphere)
                const height = isKing ? 0.15 : 0.1;
                const yScale = height / (radius * 2);
                transform.localScale = new BS.Vector3(1, yScale, 1);

                const geoArgs = [
                    BS.GeometryType.SphereGeometry, null, 1, 1, 1, 24, 16, 1,
                    radius, 24, 0, 6.283185, 0, 6.283185, 8, false,
                    radius, radius, 0, 1, 24, 8, 0.4, 16, 6.283185, 2, 3, 5, 5, 0, ""
                ];
                await piece.AddComponent(new BS.BanterGeometry(...geoArgs));
                await piece.AddComponent(new BS.BanterMaterial(shader, "", color, BS.MaterialSide.Front, false));

                // Add king crown if needed (only for sphere mode)
                if (isKing) {
                    const crown = await new BS.GameObject(`Crown_${Math.random().toString(36).substr(2, 5)}`).Async();
                    await crown.SetParent(piece, false);

                    let crownTrans = await crown.AddComponent(new BS.Transform());
                    crownTrans.localPosition = new BS.Vector3(0, 0.08 / yScale, 0);
                    crownTrans.localScale = new BS.Vector3(1, 1 / yScale, 1);

                    const crownArgs = [
                        BS.GeometryType.CylinderGeometry, null, 1, 1, 1, 1, 1, 1,
                        radius * 1.2, 24, 0, 6.283185, 0, 6.283185, 8, false,
                        radius * 1.2, radius * 1.2, 0, 1, 24, 8, 0.4, 16, 6.283185, 2, 3, 5, 5, 0, ""
                    ];
                    crownArgs[3] = 0.03;
                    await crown.AddComponent(new BS.BanterGeometry(...crownArgs));

                    const crownColor = hexToVector4(COLORS.kingCrown);
                    await crown.AddComponent(new BS.BanterMaterial(shader, "", crownColor, BS.MaterialSide.Front, false));
                }

                // Smaller collider positioned at top of piece to avoid blocking tile clicks
                await piece.AddComponent(new BS.BoxCollider(true, new BS.Vector3(0, 0.15 / yScale, 0), new BS.Vector3(0.2, 0.15 / yScale, 0.2)));
            }
            await piece.SetLayer(5);

            piece.On('click', () => {
                const currentSq = Object.keys(state.pieces).find(key => state.pieces[key] === piece);
                if (currentSq) handleSquareClick(currentSq);
            });

            piece.pieceType = pieceChar;
            return piece;
        } catch (e) {
            console.error(`Failed to create piece ${pieceChar} at ${squareId}:`, e);
            return null;
        }
    }

    async function syncBoard() {
        // Prevent multiple simultaneous syncs
        if (state.isSyncing) {
            console.log("Sync already in progress, skipping...");
            return;
        }

        state.isSyncing = true;
        console.log("Syncing board...");

        try {
            if (!state.piecesRoot) {
                state.piecesRoot = await new BS.GameObject("PiecesContainer").Async();
                await state.piecesRoot.SetParent(state.boardRoot, false);
                let trans = await state.piecesRoot.AddComponent(new BS.Transform());
                trans.localPosition = new BS.Vector3(0, 0, 0);
            }

            const gameState = window.checkersGame.getBoardState();
            const board = gameState.board;

            // Build map of what should exist
            const targetPieces = {};
            for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                    const pieceChar = board[row][col];
                    if (pieceChar) {
                        const squareId = rowColToSquare(row, col);
                        targetPieces[squareId] = pieceChar;
                    }
                }
            }

            // Track what we'll keep
            const newPieces = {};

            // Update/keep existing pieces where possible
            for (const [squareId, piece] of Object.entries(state.pieces)) {
                const targetPiece = targetPieces[squareId];

                if (targetPiece === piece.pieceType) {
                    // Piece is already in the right place with right type - keep it
                    newPieces[squareId] = piece;
                    delete targetPieces[squareId];
                } else {
                    // Piece needs to be removed (captured or moved)
                    if (piece && !piece.destroyed) {
                        piece.Destroy();
                    }
                }
            }

            // Create any missing pieces (new positions or promotions)
            for (const [squareId, pieceChar] of Object.entries(targetPieces)) {
                const piece = await createPiece(pieceChar, squareId, state.piecesRoot);
                if (piece) {
                    newPieces[squareId] = piece;
                }
            }

            state.pieces = newPieces;
            console.log("Board sync complete - optimized update.");
        } finally {
            state.isSyncing = false;
        }
    }

    async function getSpaceStateValue(key) {
        const scene = BS.BanterScene.GetInstance();
        while (!scene.localUser || scene.localUser.uid === undefined) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        const spaceState = scene.spaceState;
        if (spaceState.protected && spaceState.protected[key]) return spaceState.protected[key];
        if (spaceState.public && spaceState.public[key]) return spaceState.public[key];
        return null;
    }

    function setMaterialColor(go, hexColor) {
        if (!go) return;
        const mat = go.GetComponent(BS.ComponentType.BanterMaterial);
        if (mat) {
            const newColor = hexToVector4(hexColor);
            if (config.hideBoard && go.name.startsWith("Tile_")) {
                if (hexColor === COLORS.selected || hexColor === COLORS.valid) {
                    newColor.w = 0.5;
                } else {
                    newColor.w = 0;
                }
            }
            mat.color = newColor;
        }
    }

    function handleSquareClick(squareId) {
        const game = window.checkersGame;
        if (game.winner) return; // Game is over, do nothing

        const [row, col] = squareToRowCol(squareId);
        const stateKey = `checkers_game_${config.instance}`;

        // If must continue jump from previous move
        if (game.mustJump && game.selectedPiece) {
            const [selRow, selCol] = game.selectedPiece;
            const move = {
                from: [selRow, selCol],
                to: [row, col],
                type: 'jump'
            };

            if (game.makeMove(move)) {
                const boardState = game.getBoardState();
                BS.BanterScene.GetInstance().SetPublicSpaceProps({ [stateKey]: JSON.stringify(boardState) });
                syncBoard();
                clearSelection();
            } else {
                // Invalid move during must-jump. Re-highlight the required piece and its jumps.
                console.log("Invalid move: Must complete the jump.");
                clearSelection(); // Clear any invalid highlights
                const [selRow, selCol] = game.selectedPiece;
                const fromSquare = rowColToSquare(selRow, selCol);
                state.selectedSquare = fromSquare;
                if (state.tiles[fromSquare]) setMaterialColor(state.tiles[fromSquare], COLORS.selected);

                const validJumps = game.getValidMoves(selRow, selCol).filter(m => m.type === 'jump');
                validJumps.forEach(jump => {
                    const toSquare = rowColToSquare(jump.to[0], jump.to[1]);
                    if (state.tiles[toSquare]) setMaterialColor(state.tiles[toSquare], COLORS.valid);
                });
            }
            return;
        }

        if (!state.selectedSquare) {
            // Select piece
            const piece = game.getPiece(row, col);
            if (piece && game.isOwnPiece(piece)) {
                state.selectedSquare = squareId;
                if (state.tiles[squareId]) setMaterialColor(state.tiles[squareId], COLORS.selected);

                // Highlight valid moves (respecting forced jumps)
                const allMoves = game.getAllValidMoves();
                const validMoves = allMoves.filter(m => m.from[0] === row && m.from[1] === col);
                validMoves.forEach(move => {
                    const [toRow, toCol] = move.to;
                    const toSquare = rowColToSquare(toRow, toCol);
                    if (state.tiles[toSquare]) setMaterialColor(state.tiles[toSquare], COLORS.valid);
                });
            }
            return;
        }

        // Try to make move
        const [fromRow, fromCol] = squareToRowCol(state.selectedSquare);
        const move = {
            from: [fromRow, fromCol],
            to: [row, col]
        };

        console.log("Attempting move:", move, "Current player:", game.currentPlayer);
        if (game.makeMove(move)) {
            console.log("Move successful!");
            const boardState = game.getBoardState();
            BS.BanterScene.GetInstance().SetPublicSpaceProps({ [stateKey]: JSON.stringify(boardState) });
            syncBoard();
            clearSelection();
        } else {
            console.log("Move invalid - deselecting");
            clearSelection();
            // Try selecting different piece, but not if a jump is mandatory
            const piece = game.getPiece(row, col);
            if (piece && game.isOwnPiece(piece) && !game.mustJump) {
                handleSquareClick(squareId);
            }
        }
    }

    function clearSelection() {
        state.selectedSquare = null;

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const squareId = rowColToSquare(row, col);
                const isDark = (row + col) % 2 === 1;
                if (state.tiles[squareId]) {
                    setMaterialColor(state.tiles[squareId], isDark ? COLORS.darkSquare : COLORS.lightSquare);
                }
            }
        }
    }

    async function setupGameListeners() {
        if (state.listenersSetup) return;
        state.listenersSetup = true;

        const scene = BS.BanterScene.GetInstance();
        const stateKey = `checkers_game_${config.instance}`;

        // Listen for space state changes
        scene.On("space-state-changed", (e) => {
            const changes = e.detail.changes;
            if (changes && changes.find(c => c.property === stateKey)) {
                const spaceState = scene.spaceState;
                const val = (spaceState.public && spaceState.public[stateKey]) || (spaceState.protected && spaceState.protected[stateKey]);

                if (val) {
                    try {
                        const gameState = JSON.parse(val);
                        console.log("Syncing game state from space:", gameState);
                        window.checkersGame.loadBoardState(gameState);
                        syncBoard();
                    } catch (err) {
                        console.error("Error parsing game state:", err);
                    }
                }
            }
        });

        // Initial load
        const initialVal = await getSpaceStateValue(stateKey);
        if (initialVal) {
            try {
                const gameState = JSON.parse(initialVal);
                console.log("Loaded initial game state:", gameState);
                window.checkersGame.loadBoardState(gameState);
                syncBoard();
            } catch (err) {
                console.error("Error parsing initial game state:", err);
            }
        }
    }

    // --- Main Initializer ---
    async function init() {
        await loadDependencies();

        if (!window.checkersGame) {
            window.checkersGame = new CheckersGame();
        }

        if (window.BS) {
            BS.BanterScene.GetInstance().On("unity-loaded", async () => {
                console.log("Banter Unity Loaded. Initializing checkers scene...");
                await initializeBoard();
            });
        } else {
            console.error("Banter SDK (BS) not found.");
        }
    }

    init();

})();
