// Import necessary modules and libraries
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { addMonths } = require('date-fns');

// Define a function to initialize the API
function initializeDepreciationAPI() {
    // Create an Express application
    const app = express();
    const PORT = process.env.PORT || 3000;

    // Parse incoming request bodies in a middleware before your handlers
    app.use(bodyParser.json());

    // Connect to MongoDB database
    mongoose.connect('mongodb://localhost:27017/depreciationDB', { useNewUrlParser: true, useUnifiedTopology: true })
        .then(() => console.log('Connected to MongoDB'))
        .catch(err => console.error('Error connecting to MongoDB:', err));

   // Function to calculate depreciation
// Function to calculate depreciation
function calculateDepreciation(cost, depreciationRate, months, purchaseDate, companyId, assetId) {
    // Validate purchaseDate
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(purchaseDate)) {
        throw new Error('Invalid purchaseDate format. Date should be in YYYY-MM-DD format.');
    }

    // Parse the purchaseDate string to a Date object
    const parsedPurchaseDate = new Date(purchaseDate);

    // Check if the parsed date is valid
    if (isNaN(parsedPurchaseDate.getTime())) {
        throw new Error('Invalid purchaseDate. Please provide a valid date.');
    }

    // Calculate monthly depreciation
    const monthlyDepreciation = depreciationRate ? (cost * depreciationRate) / 12 : cost / months;

    // Initialize variables for the depreciation schedule
    const depreciationSchedule = [];
    let currentCost = cost;
    let currentDate = parsedPurchaseDate;
    let month = 0;
    let startYear, endYear;

    // Iterate until the currentCost becomes 0
    while (currentCost > 0) {
        month++;

        // Determine start and end years based on the current month
        if (currentDate.getMonth() >= 3) { // April (0-indexed)
            startYear = currentDate.getFullYear();
            endYear = startYear + 1;
        } else {
            startYear = currentDate.getFullYear() - 1;
            endYear = currentDate.getFullYear();
        }

        const financialYear = `${startYear}-${endYear}`;
        const depreciation = Math.min(currentCost, monthlyDepreciation);
        const roundedDepreciation = parseFloat(depreciation.toFixed(2));
        depreciationSchedule.push({
            companyId,
            assetId,
            month,
            financialYear,
            depreciation: roundedDepreciation
        });
        currentCost -= depreciation;

        // Move to the next month
        currentDate = addMonths(currentDate, 1);
    }

    // Return the depreciation schedule and number of months calculated
    return { depreciationSchedule, months: month };
}

    
    
    

    // Define a schema for depreciation records
    const depreciationSchema = new mongoose.Schema({
        companyId:{type:String,required:true},
        assetId:{type:String,required:true},
        cost: { type: Number, required: true },
        depreciationRate: { type: Number },
        months: { type: Number },
        purchaseDate: { type: Date, required: true },
        depreciationSchedule: [{ companyId: String,assetId: String,month: Number, financialYear: String, depreciation: Number }],
        monthsCalculated: Number
    });

    // Create a model based on the schema
    const Depreciation = mongoose.model('depreciationDB', depreciationSchema);

    // POST API endpoint to calculate depreciation and save it to the database
    // POST API endpoint to calculate depreciation and save it to the database
app.post('/api/depreciation', async (req, res) => {
    try {
        const { companyId, assetId, cost, depreciationRate, months, purchaseDate } = req.body;

        // Validation: Check if depreciationRate, cost, or months is negative
        if (depreciationRate < 0 || cost < 0 || months < 0) {
            return res.status(400).json({ message: 'Negative values are not allowed for depreciationRate, cost, or months.' });
        }

        if ((depreciationRate && months) || (!depreciationRate && !months)) {
            return res.status(400).json({ message: 'Provide either depreciationRate or months, not both.' });
        }

        const { depreciationSchedule, months: monthsCalculated } = calculateDepreciation(cost, depreciationRate, months, purchaseDate, companyId, assetId);

        // Save depreciation record to the database
        const newDepreciation = new Depreciation({
            companyId,
            assetId,
            cost,
            depreciationRate,
            months,
            purchaseDate,
            depreciationSchedule,
            monthsCalculated
        });
        await newDepreciation.save();

        // Send back the saved depreciation record with companyId and assetId included
        res.status(200).json({
            message: 'Depreciation calculated and saved successfully',
            depreciation: {
                companyId: newDepreciation.companyId,
                assetId: newDepreciation.assetId,
                cost: newDepreciation.cost,
                depreciationRate: newDepreciation.depreciationRate,
                purchaseDate: newDepreciation.purchaseDate,
                depreciationSchedule: newDepreciation.depreciationSchedule,
                monthsCalculated: newDepreciation.monthsCalculated
            }
        });
    } catch (error) {
        console.error('Error calculating and saving depreciation:', error);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
});


  // GET API endpoint to fetch depreciation records by companyId or assetId
app.get('/api/depreciation', async (req, res) => {
    try {
        const { companyId, assetId } = req.query;
        let query = {};

        // Check if either companyId or assetId is provided in the query parameters
        if (companyId) {
            query.companyId = companyId;
        } else if (assetId) {
            query.assetId = assetId;
        } else {
            // If neither companyId nor assetId is provided, return an error
            return res.status(400).json({ message: 'Please provide either companyId or assetId' });
        }

        // Fetch depreciation records based on the constructed query
        const depreciationRecords = await Depreciation.find(query);
        res.status(200).json(depreciationRecords);
    } catch (error) {
        console.error('Error fetching depreciation records:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// DELETE API endpoint to delete depreciation records by companyId or assetId
app.delete('/api/depreciation', async (req, res) => {
    try {
        const { companyId, assetId } = req.query;
        if (!companyId && !assetId) {
            return res.status(400).json({ message: 'Either company ID or asset ID is required' });
        }

        let query = {};
        if (companyId) {
            query = { companyId };
        } else {
            query = { assetId };
        }

        const deletedDepreciation = await Depreciation.deleteMany(query);
        if (deletedDepreciation.deletedCount === 0) {
            return res.status(404).json({ message: 'No depreciation records found for the provided criteria' });
        }
        res.status(200).json({ message: 'Depreciation records deleted successfully', count: deletedDepreciation.deletedCount });
    } catch (error) {
        console.error('Error deleting depreciation records:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


    // Start the server
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

// Call the function to initialize the API
initializeDepreciationAPI();
