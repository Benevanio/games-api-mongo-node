const express = require("express");
const app = express();
const dotenv = require("dotenv");
dotenv.config();
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const swaggerDocs = require("./swagger");
const e = require("express");

const JWTSecret = "djkshahjksdajksdhasjkdhasjkdhasjkdhasjkd";

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

swaggerDocs(app);

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * security:
 *   - BearerAuth: []
 */

function auth(req, res, next) {
    const authToken = req.headers['authorization'];
    if (authToken) {
        const bearer = authToken.split(' ');
        const token = bearer[1];

        jwt.verify(token, JWTSecret, (err, data) => {
            if (err) {
                res.status(401).json({ err: "Token inválido!" });
            } else {
                req.token = token;
                req.loggedUser = { id: data.id, email: data.email };
                req.empresa = "BeneTesla";
                next();
            }
        });
    } else {
        res.status(401).json({
            err: "Inclua o token para acessar este recurso!"
        });
    }
}

mongoose.connect(process.env.DATABASE, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log("✅ Conexão com o banco de dados estabelecida!");
    })
    .catch((err) => {
        console.error("❌ Erro ao conectar com o banco de dados: ", err);
    });

const GamesSchema = new mongoose.Schema({
    title: { type: String, required: true },
    year: { type: Number, required: true },
    price: { type: Number, required: true }
});

const UsersSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

const Games = mongoose.model("Games", GamesSchema);
const Users = mongoose.model("Users", UsersSchema);


app.post("/auth", async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await Users.findOne({ email, password });
        if (!user) return res.status(404).json({ err: "Usuário e/ou senha inválidos!" });

        res.status(200).json({
            token: jwt.sign({ id: user.id, email: user.email }, JWTSecret, { expiresIn: "48h" })
        });

    } catch (err) {
        res.status(500).json({ err: "Erro ao buscar usuário!" });
    }
});

/**
 * @swagger
 * /games:
 *   get:
 *     summary: Retorna a lista de jogos
 *     description: Retorna todos os jogos cadastrados no banco de dados.
 *     tags:
 *       - Jogos
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de jogos retornada com sucesso
 */
app.get("/games", auth, async (req, res) => {
    let HATEOAS = [
        {
            href: "http://localhost:3000/game/0",
            method: "DELETE",
            rel: "delete_game"
        },
        {
            href: "http://localhost:3000/game/0",
            method: "GET",
            rel: "get_game"
        },
        {
            href: "http://localhost:3000/game/0",
            method: "PUT",
            rel: "edit_game"
        }
    ]
    try {
        const games = await Games.find();
        res.status(200).json({ empresa: req.empresa, user: req.loggedUser, games, _links: HATEOAS });

    } catch (err) {
        res.status(500).json({ err: "Erro ao buscar jogos!" });
    }
});

/**
 * @swagger
 * /game/{id}:
 *   get:
 *     summary: Retorna um jogo específico pelo ID
 *     description: Busca um jogo no banco de dados pelo seu ID.
 *     tags:
 *       - Jogos
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID do jogo a ser buscado
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Retorna o jogo encontrado
 *       404:
 *         description: Jogo não encontrado
 */
app.get("/game/:id", auth, async (req, res) => {
    try {
        const game = await Games.findById(req.params.id);
        if (!game) return res.status(404).json({ err: "Jogo não encontrado!" });

        res.status(200).json(game);
    } catch (err) {
        res.status(500).json({ err: "Erro ao buscar o jogo!" });
    }
});

/**
 * @swagger
 * /game:
 *   post:
 *     summary: Cria um novo jogo
 *     description: Adiciona um novo jogo ao banco de dados.
 *     tags:
 *       - Jogos
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               year:
 *                 type: number
 *               price:
 *                 type: number
 *     responses:
 *       201:
 *         description: Jogo criado com sucesso
 */
app.post("/game", auth, async (req, res) => {
    try {
        const { title, price, year } = req.body;
        const newGame = new Games({ title, price, year });
        await newGame.save();
        res.status(201).json(newGame);
    } catch (err) {
        res.status(500).json({ err: "Erro ao criar o jogo!" });
    }
});

/**
 * @swagger
 * /game/{id}:
 *   put:
 *     summary: Atualiza um jogo existente
 *     description: Atualiza os dados de um jogo pelo ID.
 *     tags:
 *       - Jogos
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID do jogo a ser atualizado
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               year:
 *                 type: number
 *               price:
 *                 type: number
 *     responses:
 *       200:
 *         description: Jogo atualizado com sucesso
 *       404:
 *         description: Jogo não encontrado
 */
app.put("/game/:id", auth, async (req, res) => {
    try {
        const { title, price, year } = req.body;
        const updatedGame = await Games.findByIdAndUpdate(
            req.params.id,
            { title, price, year },
            { new: true }
        );
        if (!updatedGame) return res.status(404).json({ err: "Jogo não encontrado!" });

        res.status(200).json(updatedGame);
    } catch (err) {
        res.status(500).json({ err: "Erro ao atualizar o jogo!" });
    }
});

/**
 * @swagger
 * /game/{id}:
 *   delete:
 *     summary: Remove um jogo pelo ID
 *     description: Exclui um jogo do banco de dados.
 *     tags:
 *       - Jogos
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: ID do jogo a ser deletado
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Jogo deletado com sucesso
 */
app.delete("/game/:id", auth, async (req, res) => {
    try {
        const deletedGame = await Games.findByIdAndDelete(req.params.id);
        if (!deletedGame) return res.status(404).json({ err: "Jogo não encontrado!" });

        res.sendStatus(200);
    } catch (err) {
        res.status(500).json({ err: "Erro ao deletar o jogo!" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 API rodando na porta ${PORT}`);
});
