<?php

namespace Workdo\BudgetPlanner\Exceptions;

use RuntimeException;

/**
 * Thrown by CommitmentService when a transaction would exceed available budget
 * and the control mode for that economic classification is 'hard_block'.
 *
 * Callers (purchase invoice post, LPO issue, etc.) should catch this and
 * return a user-facing error without proceeding with the transaction.
 */
class BudgetExceededException extends RuntimeException
{
    //
}
