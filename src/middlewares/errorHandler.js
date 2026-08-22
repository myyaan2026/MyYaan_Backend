//Centralized error handling

const errorHandling = (err, req, res, next) => {
    console.log(err.stack);
    res.status(500).json({
        status: 500,
        message: "Sonething went wrong",
        error: err.message
    });
};

export default errorHandling;