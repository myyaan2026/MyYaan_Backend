const errorHandling = (err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        status: 500,
        message: "Something went wrong",
        data: null,
        ...(process.env.NODE_ENV !== "production" && { error: err.message }),
    });
};

export default errorHandling;
