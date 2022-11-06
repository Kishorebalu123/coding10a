const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt=require("bcrypt")
const jwt=require("jsonwebtoken")

const databasePath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();
app.use(express.json());
let database = null;

const initializeDbAndServer = async (request, response) => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error:${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await database.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
const convertStateObjectToResponseObject=(DbObject)=>{
    return{
        stateId:DbObject.state_id,
        stateName:DbObject.state_name,
        population:DbObject.population
    }
}
const convertDistrictObjectToResponseObject=(DbObject)=>{
    return{
        districtId:DbObject.district_id,
        districtName:DbObject.district_name,
        stateId:DbObject.state_id,
        cases:DbObject.cases,
        cured:DbObject.cured,
        active:DbObject.active,
        deaths:DbObject.deaths
    }
}

 const convertDbObjectToResponse = (DbObject) => {
  return {
    totalCases: DbObject.total_cases,
    totalCured: DbObject.total_cured,
    totalActive: DbObject.total_active,
    totalDeaths: DbObject.total_deaths,
  };
};

app.get("/states/",authenticateToken,async(request, response) => {
   const getStatesQuery = `
            SELECT
              *
            FROM
             state
            ORDER BY
             state_id;`;
        const states = await database.all(getStatesQuery);
        response.send(states.map((each)=>convertStateObjectToResponseObject(each)));
      
    });
app.get("/states/:stateId/",authenticateToken,async(request,response)=>{
    const{stateId}=request.params
    const getStateQuery=`
    SELECT * FROM state WHERE state_id='${stateId};'`
const state = await database.get(getStateQuery)
response.send(convertStateObjectToResponseObject(state))
})
app.post("/districts/",authenticateToken,async(request,response)=>{
    const {districtName,stateId,cases,cured,active,deaths}=request.body
    const postDistrictQuery=`
    INSERT INTO district (district_name,state_id,cases,cured,active,deaths)
    VALUES('${districtName}','${stateId}','${cases}','${cured}','${active}','${deaths}')`
    await database.run(postDistrictQuery)
    response.send("District Successfully Added")
})

app.get("/districts/:districtId/",authenticateToken,async(request,response)=>{
    const {districtId}=request.params
    const getDistrictQuery=`
    SELECT * FROM district WHERE district_id='${districtId}'`
    const district=await database.get(getDistrictQuery)
response.send(convertDistrictObjectToResponseObject(district))
})

app.delete("/districts/:districtId/",authenticateToken,async(request,response)=>{
    const {districtId}=request.params
    const deleteQuery=`
    DELETE FROM district WHERE district_id='${districtId}'`
    await database.run(deleteQuery)
    response.send("District Removed")
})
app.put("/districts/:districtId/",authenticateToken,async(request,response)=>{
    const {districtName,stateId,cases,cured,active,deaths}=request.body
    const{districtId}=request.params
    const districtUpdateQuery=`
    UPDATE district SET district_name='${districtName}',state_id='${stateId}',cases='${cases}',cured='${cured}',active='${active}',deaths='${deaths}'
    WHERE district_id='${districtId}'`
    await database.run(districtUpdateQuery)
    response.send("District Details Updated")
})

app.get("/states/:stateId/stats/",authenticateToken,async(request,response)=>{
    const {stateId}=request.params
    const getStatsQuery=`
    SELECT SUM(cases) AS totalCases,SUM(cured) AS totalCured,SUM(active) AS totalActive,SUM(deaths) AS totalDeaths FROM district NATURAL JOIN state WHERE state_id='${stateId}'`
    const stats=await database.get(getStatsQuery)
response.send(stats)
})

module.exports =app